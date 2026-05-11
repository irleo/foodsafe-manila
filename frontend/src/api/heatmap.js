const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export async function fetchDistrictHeatmap(
  token,
  { datasetId, year, month, disease, caseClassification } = {},
) {
  const params = new URLSearchParams();
  if (datasetId) params.set("datasetId", datasetId);
  if (year != null && year !== "" && year !== "All")
    params.set("year", String(year));
  if (month != null && month !== "" && month !== "All")
    params.set("month", String(month));
  if (disease && disease !== "All") params.set("disease", String(disease));
  if (caseClassification && caseClassification !== "All")
    params.set("caseClassification", String(caseClassification));

  const qs = params.toString();
  const res = await fetch(
    `${API_BASE}/api/heatmap/districts${qs ? `?${qs}` : ""}`,
    {
      headers: { Authorization: token ? `Bearer ${token}` : "" },
    },
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.message || "Failed to load heatmap data.");
  const points = Array.isArray(j.points) ? j.points : Array.isArray(j) ? j : [];
  return {
    points,
    districtStats: Array.isArray(j.districtStats) ? j.districtStats : [],
    filterOptions: j.filterOptions || {},
  };
}
