import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FORECAST_SCRIPT = join(__dirname, "forecast.py");

function pythonBinary() {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  return process.platform === "win32" ? "python" : "python3";
}

/**
 * @param {{ year: number, y: number }[]} series
 * @returns {Promise<{
 *   compareRows: object[],
 *   nextForecast: object,
 *   metrics: { mape: number|null, rmse: number }
 * }>}
 */
export function runProphetForecast(series) {
  const py = pythonBinary();
  return new Promise((resolve, reject) => {
    const child = spawn(py, [FORECAST_SCRIPT], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      reject(
        new Error(
          `Failed to start Python (${py}). Set PYTHON_BIN or install Python. ${err.message}`,
        ),
      );
    });
    child.on("close", (code) => {
      const trimmed = stdout.trim();
      let parsed;
      try {
        parsed = trimmed ? JSON.parse(trimmed) : null;
      } catch {
        reject(
          new Error(
            `Prophet script returned non-JSON. stderr: ${stderr || "(empty)"} stdout: ${trimmed.slice(0, 500)}`,
          ),
        );
        return;
      }
      if (parsed && parsed.ok === false) {
        reject(
          new Error(
            parsed.error === "prophet_import_failed"
              ? "Prophet is not installed. Run: pip install -r backend/services/prophet/requirements.txt"
              : parsed.error || "prophet_failed",
          ),
        );
        return;
      }
      if (!parsed || !parsed.ok) {
        reject(new Error(stderr || `Prophet exited with code ${code}`));
        return;
      }
      resolve(parsed);
    });
    child.stdin.write(JSON.stringify({ series }));
    child.stdin.end();
  });
}
