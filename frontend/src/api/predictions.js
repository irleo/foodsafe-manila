const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

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
  const res = await fetch(`${API_BASE}/api/predictions${suffix}`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  const j = await res.json().catch(() => ({}));
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
  const res = await fetch(`${API_BASE}/api/predictions/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify({ datasetId, forecastHorizonMonths }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(j.message || "Prediction refresh failed");
  }
  if (!j.accepted) return j;

  const timeoutAt = Date.now() + (15 * 60 * 1000);
  while (Date.now() < timeoutAt) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const latest = await fetchLatestPredictions(token, { datasetId });
    if (latest?.refreshJob?.status === "failed") {
      throw new Error(latest.refreshJob.errorMessage || "Global forecast refresh failed");
    }
    if (latest?.refreshJob?.status === "succeeded") return latest;
  }
  throw new Error("The global forecast is still processing. You can leave this page and return later.");
}
