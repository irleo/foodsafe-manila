const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const THRESHOLD_CACHE_TTL_MS = 30_000;
const THRESHOLD_CACHE_MAX_ENTRIES = 48;
const currentThresholdCache = new Map();

function pruneCurrentThresholdCache(now) {
  for (const [key, entry] of currentThresholdCache) {
    if (entry.expiresAt <= now) currentThresholdCache.delete(key);
  }
  while (currentThresholdCache.size >= THRESHOLD_CACHE_MAX_ENTRIES) {
    currentThresholdCache.delete(currentThresholdCache.keys().next().value);
  }
}

async function thresholdRequest(token, path, options = {}) {
  const response = await fetch(`${API_BASE}/api/thresholds${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Threshold request failed");
  return data;
}

export const fetchCurrentThreshold = (token, datasetId, { disease, district, targetYear, targetMonth } = {}) => {
  const params = new URLSearchParams({ datasetId });
  if (disease) params.set("disease", disease);
  if (district) params.set("district", district);
  if (targetYear) params.set("targetYear", String(targetYear));
  if (targetMonth) params.set("targetMonth", String(targetMonth));
  const path = `/current?${params.toString()}`;
  const cacheKey = `${token || "anonymous"}:${path}`;
  const now = Date.now();
  const cached = currentThresholdCache.get(cacheKey);
  if (cached?.expiresAt > now) return cached.promise;

  pruneCurrentThresholdCache(now);
  const promise = thresholdRequest(token, path);
  const entry = {
    promise,
    expiresAt: now + THRESHOLD_CACHE_TTL_MS,
  };
  currentThresholdCache.set(cacheKey, entry);
  promise.then(undefined, () => {
    if (currentThresholdCache.get(cacheKey) === entry) {
      currentThresholdCache.delete(cacheKey);
    }
  });
  return promise;
};

export const fetchThresholdSettings = (token) => thresholdRequest(token, "/settings");

export const updateThresholdSettings = (token, payload) =>
  thresholdRequest(token, "/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  }).then((response) => {
    currentThresholdCache.clear();
    return response;
  });
