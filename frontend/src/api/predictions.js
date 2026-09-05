const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const REQUEST_TIMEOUT_MS = 15_000;
const REFRESH_TIMEOUT_MS = 13 * 60 * 1000;

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const body = await res.json().catch(() => ({}));
    return { res, body };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("The prediction service did not respond in time.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Load latest saved PredictionRun (DB-backed).
 * @param {string} token
 * @param {{ datasetId?: string, districtKey?: string, district?: string }} [opts]
 */
export async function fetchLatestPredictions(
  token,
  { datasetId, districtKey, district } = {},
) {
  const qs = new URLSearchParams();
  if (datasetId) qs.set("datasetId", datasetId);
  if (districtKey) qs.set("districtKey", districtKey);
  if (district) qs.set("district", district);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const { res, body: j } = await fetchJson(`${API_BASE}/api/predictions${suffix}`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!res.ok) {
    throw new Error(j.message || "Prediction request failed");
  }
  return j;
}

/**
 * Admin/CESU: refresh predictions now (recompute + persist).
 * @param {string} token
 * @param {{ datasetId?: string, forecastHorizonMonths?: number }} [opts]
 */
export async function refreshPredictions(
  token,
  { datasetId, forecastHorizonMonths } = {},
) {
  const { res, body: j } = await fetchJson(`${API_BASE}/api/predictions/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify({ datasetId, forecastHorizonMonths }),
  });
  if (!res.ok) {
    throw new Error(j.message || "Prediction refresh failed");
  }
  if (!j.accepted) return j;

  const jobId = j.refreshJob?.jobId;
  if (!jobId) {
    throw new Error("The prediction service did not return a refresh job ID.");
  }
  const pollDatasetId = datasetId || j.refreshJob?.datasetId;

  const timeoutAt = Date.now() + REFRESH_TIMEOUT_MS;
  while (Date.now() < timeoutAt) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const latest = await fetchLatestPredictions(token, {
      datasetId: pollDatasetId,
    });
    const refreshJob = latest?.refreshJob;
    if (!refreshJob || refreshJob.status === "idle") {
      throw new Error("The prediction refresh was interrupted. Please try again.");
    }
    if (refreshJob.jobId !== jobId) {
      throw new Error("The prediction refresh was replaced by another job.");
    }
    if (refreshJob.status === "failed") {
      throw new Error(
        refreshJob.errorMessage || "Global forecast refresh failed",
      );
    }
    if (refreshJob.status === "succeeded") return latest;
  }
  throw new Error(
    "Prediction refresh exceeded its time limit. Please check the Render logs.",
  );
}
