const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

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

export const fetchCurrentThreshold = (token, datasetId, district) => {
  const params = new URLSearchParams({ datasetId });
  if (district) params.set("district", district);
  return thresholdRequest(token, `/current?${params.toString()}`);
};

export const fetchThresholdSettings = (token) => thresholdRequest(token, "/settings");

export const updateThresholdSettings = (token, payload) =>
  thresholdRequest(token, "/settings", { method: "PUT", body: JSON.stringify(payload) });
