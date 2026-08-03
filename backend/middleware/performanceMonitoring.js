import { getForecastExecutionStats } from "../services/predictions/forecastExecution.js";

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function monitorRequestPerformance(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const slowThresholdMs = positiveInteger(
      process.env.PERF_SLOW_REQUEST_MS,
      1_000,
    );

    if (
      process.env.PERF_LOG_ALL_REQUESTS === "true" ||
      durationMs >= slowThresholdMs
    ) {
      // req.path intentionally excludes query strings, which can contain location data.
      console.log(
        `[api] ${req.method} ${req.path} status=${res.statusCode} durationMs=${durationMs.toFixed(1)}`,
      );
    }
  });

  next();
}

export function startProcessMemoryMonitor() {
  if (process.env.PERF_MEMORY_MONITOR === "false") return null;

  const intervalMs = Math.max(
    30_000,
    positiveInteger(process.env.PERF_MEMORY_INTERVAL_MS, 300_000),
  );

  const timer = setInterval(() => {
    const usage = process.memoryUsage();
    const forecast = getForecastExecutionStats();
    const toMb = (bytes) => Math.round((bytes / 1024 / 1024) * 10) / 10;

    console.log(
      `[memory] rssMb=${toMb(usage.rss)} heapUsedMb=${toMb(usage.heapUsed)} externalMb=${toMb(usage.external)} forecastActive=${forecast.activeLabel || "none"} forecastPending=${forecast.pendingCount}`,
    );
  }, intervalMs);

  timer.unref?.();
  return timer;
}
