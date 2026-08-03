function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function createAsyncTtlCache({ name, defaultTtlMs = 60_000 }) {
  const entries = new Map();
  const stats = {
    hits: 0,
    misses: 0,
    coalesced: 0,
    loads: 0,
    errors: 0,
  };

  function peek(key) {
    const entry = entries.get(key);
    if (!entry || entry.pending || entry.expiresAt <= Date.now()) return null;
    return entry.value;
  }

  function logEvent(event, key) {
    if (process.env.PERF_LOG_CACHE === "true") {
      console.log(`[cache:${name}] ${event} ${key}`);
    }
  }

  async function getOrLoad(key, loader, { ttlMs = defaultTtlMs } = {}) {
    const now = Date.now();
    const existing = entries.get(key);

    if (existing?.pending) {
      stats.coalesced += 1;
      logEvent("coalesced", key);
      return existing.pending;
    }

    if (existing && existing.expiresAt > now) {
      stats.hits += 1;
      logEvent("hit", key);
      return existing.value;
    }

    stats.misses += 1;
    logEvent("miss", key);
    const startedAt = Date.now();
    const resolvedTtlMs = positiveInteger(ttlMs, defaultTtlMs);

    const pending = Promise.resolve()
      .then(loader)
      .then((value) => {
        stats.loads += 1;
        entries.set(key, {
          value,
          expiresAt: Date.now() + resolvedTtlMs,
          pending: null,
        });

        const durationMs = Date.now() - startedAt;
        const slowThresholdMs = positiveInteger(
          process.env.PERF_SLOW_CACHE_MS,
          500,
        );
        if (
          process.env.PERF_LOG_CACHE === "true" ||
          durationMs >= slowThresholdMs
        ) {
          console.log(`[cache:${name}] loaded ${key} in ${durationMs}ms`);
        }

        return value;
      })
      .catch((error) => {
        stats.errors += 1;
        const current = entries.get(key);
        if (current?.pending === pending) entries.delete(key);
        throw error;
      });

    entries.set(key, {
      value: null,
      expiresAt: 0,
      pending,
    });

    return pending;
  }

  function clear(key) {
    if (key === undefined) entries.clear();
    else entries.delete(key);
  }

  function getStats() {
    return { name, entries: entries.size, ...stats };
  }

  return { clear, getOrLoad, getStats, peek };
}
