const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

async function parseError(res) {
  const j = await res.json().catch(() => ({}));
  return j?.message || `Request failed (${res.status})`;
}

export async function fetchDatasets({ token } = {}) {
  const res = await fetch(`${API_BASE}/api/datasets`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
    },
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function uploadDataset({
  file,
  name,
  coverageStart,
  coverageEnd,
  dataSource,
  token,
}) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("name", name);
  formData.append("coverageStart", coverageStart);
  formData.append("coverageEnd", coverageEnd);
  formData.append("dataSource", dataSource);

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

export async function downloadDatasetFile({ datasetId, token }) {
  const res = await fetch(`${API_BASE}/api/datasets/${datasetId}/download`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
    },
  });

  if (!res.ok) throw new Error(await parseError(res));

  const blob = await res.blob();
  const cd = res.headers.get("content-disposition");
  const match = cd?.match(/filename="(.+)"/);
  const filename = match?.[1] || "dataset.csv";

  return { blob, filename };
}
