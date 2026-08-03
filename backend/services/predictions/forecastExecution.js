let queueTail = Promise.resolve();
let activeLabel = null;
let pendingCount = 0;
const inFlightByKey = new Map();

export function runSerializedForecast({ key, label }, task) {
  const existing = inFlightByKey.get(key);
  if (existing) {
    console.log(`[forecast] reusing queued or active job: ${label}`);
    return existing;
  }

  const queuedAt = Date.now();
  pendingCount += 1;

  const run = queueTail
    .catch(() => undefined)
    .then(async () => {
      pendingCount -= 1;
      activeLabel = label;
      const startedAt = Date.now();
      const waitMs = startedAt - queuedAt;
      console.log(
        `[forecast] started ${label}; queueWaitMs=${waitMs}; pending=${pendingCount}`,
      );

      try {
        return await task();
      } finally {
        const durationMs = Date.now() - startedAt;
        console.log(`[forecast] finished ${label}; durationMs=${durationMs}`);
        activeLabel = null;
      }
    });

  queueTail = run.catch(() => undefined);
  inFlightByKey.set(key, run);

  const cleanup = () => {
    if (inFlightByKey.get(key) === run) inFlightByKey.delete(key);
  };
  run.then(cleanup, cleanup);

  return run;
}

export function getForecastExecutionStats() {
  return {
    activeLabel,
    pendingCount,
    uniqueJobs: inFlightByKey.size,
  };
}
