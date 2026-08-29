import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "forecast_monthly.py");

function pythonBinary() {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  return process.platform === "win32" ? "python" : "python3";
}

/**
 * @param {{ year:number, month:number, y:number }[]} series
 * @param {{ horizonMonths:number }} opts
 */
export function runProphetMonthlyForecast(
  series,
  { horizonMonths = 1 } = {},
) {
  const py = pythonBinary();
  return new Promise((resolve, reject) => {
    const child = spawn(py, [SCRIPT], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      reject(
        new Error(
          `Failed to start Python (${py}). Set PYTHON_BIN or install Python. ${err.message}`
        )
      );
    });
    child.on("close", (code) => {
      const text = (stdout || "").trim();
      let parsed;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        // Some Prophet/CmdStan stacks print logs before JSON; parse the final
        // object-shaped payload as a fallback.
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        const candidate = start >= 0 && end > start ? text.slice(start, end + 1) : "";
        try {
          parsed = candidate ? JSON.parse(candidate) : null;
        } catch {
          reject(
            new Error(
              `Monthly Prophet returned non-JSON. stderr: ${stderr || "(empty)"}`
            )
          );
          return;
        }
      }
      if (parsed && parsed.ok === false) {
        reject(
          new Error(
            parsed.error === "prophet_import_failed"
              ? "Prophet is not installed. Run: pip install -r backend/services/prophet/requirements.txt"
              : parsed.error || "prophet_failed"
          )
        );
        return;
      }
      if (!parsed || !parsed.ok) {
        reject(new Error(stderr || `Prophet exited with code ${code}`));
        return;
      }
      resolve(parsed);
    });

    child.stdin.write(
      JSON.stringify({ series, horizonMonths }),
    );
    child.stdin.end();
  });
}

