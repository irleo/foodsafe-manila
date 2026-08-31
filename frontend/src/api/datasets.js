const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

async function parseError(res) {
  const j = await res.json().catch(() => ({}));
  const summary = j?.message || j?.reason || `Request failed (${res.status})`;
  const firstIssue = Array.isArray(j?.validationErrors)
    ? j.validationErrors.find((issue) => issue?.message)
    : null;
  if (!firstIssue?.message || summary.includes(firstIssue.message)) return summary;
  const location = [
    firstIssue.sheet,
    firstIssue.row ? `row ${firstIssue.row}` : null,
  ].filter(Boolean).join(", ");
  return `${summary} ${location ? `${location}: ` : ""}${firstIssue.message}`;
}

export async function fetchDatasets({ token, status, providerType, page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set("status", status);
  if (providerType) params.set("providerType", providerType);
  const res = await fetch(`${API_BASE}/api/datasets?${params.toString()}`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    pagination: data?.pagination || null,
  };
}

export async function uploadDataset({
  file,
  name,
  reportingFrequency,
  districtCoverage,
  token,
}) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("name", name);
  formData.append("reportingFrequency", reportingFrequency);
  if (Array.isArray(districtCoverage)) {
    formData.append("districtCoverage", JSON.stringify(districtCoverage));
  }

  const res = await fetch(`${API_BASE}/api/datasets/upload`, {
    method: "POST",
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: formData,
  });

  if (!res.ok) throw new Error(await parseError(res));
  return await res.json();
}

export async function downloadOfficialCaseTemplate({ token }) {
  const res = await fetch(`${API_BASE}/api/datasets/template/official-cases`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!res.ok) throw new Error(await parseError(res));
  const blob = await res.blob();
  if (!blob.size) throw new Error("Template response was empty.");
  const cd = res.headers.get("content-disposition");
  const match = cd?.match(/filename="(.+)"/);
  const filename = match?.[1] || "FoodSafe_Template.xlsx";
  return { blob, filename };
}

export async function downloadDatasetFile({ datasetId, token }) {
  const res = await fetch(`${API_BASE}/api/datasets/${datasetId}/download`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
    },
  });

  if (!res.ok) throw new Error(await parseError(res));

  const blob = await res.blob();
  if (!blob.size) throw new Error("Dataset response was empty.");
  const cd = res.headers.get("content-disposition");
  const match = cd?.match(/filename="(.+)"/);
  const filename = match?.[1] || "dataset.xlsx";

  return { blob, filename };
}
