const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

/**
 * Load latest saved forecast payload (DB-backed).
 * @param {string} token
 * @param {{ datasetId?: string }} [opts]
 */
export async function fetchLatestPredictions(token, { datasetId } = {}) {
  const qs = new URLSearchParams();
  if (datasetId) qs.set("datasetId", datasetId);
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
 * Admin-only: refresh predictions now (recompute + persist).
 * @param {string} token
 * @param {{ datasetId?: string }} [opts]
 */
export async function refreshPredictions(token, { datasetId } = {}) {
  const res = await fetch(`${API_BASE}/api/predictions/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify({ datasetId }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(j.message || "Prediction refresh failed");
  }
  return j;
}
