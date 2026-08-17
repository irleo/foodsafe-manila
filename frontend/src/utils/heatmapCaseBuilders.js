import { manilaDistrictCoords, normalizeDistrictKey } from "../constants/manilaDistrictCoords";

export function getConcentrationColor(cases, maximumCases = 1) {
  const ratio = Math.max(0, Number(cases || 0)) / Math.max(1, Number(maximumCases || 1));
  if (ratio >= 0.75) return "#1e3a8a";
  if (ratio >= 0.5) return "#2563eb";
  if (ratio >= 0.25) return "#60a5fa";
  if (ratio > 0) return "#bfdbfe";
  return "#e5e7eb";
}

export function getRadius(cases) {
  const r = 8 + Math.sqrt(Math.max(1, cases)) * 4;
  return Math.min(34, Math.max(10, r));
}

// ---------- Filters (OfficialCase-based) ----------

export function filterOfficialCases(
  rows = [],
  { district = "All", disease = "All", year = "All" } = {}
) {
  const list = Array.isArray(rows) ? rows : [];

  return list.filter((r) => {
    const dOk = district === "All" ? true : r?.district === district;
    const disOk = disease === "All" ? true : r?.disease === disease;
    const yOk = year === "All" ? true : Number(r?.year) === Number(year);
    return dOk && disOk && yOk;
  });
}

// ---------- Dropdown helpers ----------

export function getUniqueDistrictsFromCases(rows = []) {
  const set = new Set();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r?.district) set.add(r.district);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function getUniqueDiseasesFromCases(rows = []) {
  const set = new Set();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r?.disease) set.add(r.disease);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function getUniqueYearsFromCases(rows = []) {
  const set = new Set();
  for (const r of Array.isArray(rows) ? rows : []) {
    const y = Number(r?.year);
    if (Number.isFinite(y)) set.add(y);
  }
  return Array.from(set).sort((a, b) => a - b);
}

// ---------- Heatmap builders (OfficialCase → district points) ----------

export function buildDistrictHeatmapPointsFromCases(rows = []) {
  const map = new Map();

  for (const r of Array.isArray(rows) ? rows : []) {
    const district = String(r?.district || "").trim();
    const disease = String(r?.disease || "Unknown").trim();
    const cases = Number(r?.cases ?? 0);

    if (!district || !Number.isFinite(cases) || cases < 0) continue;

    const key = normalizeDistrictKey(district);
    const coords = manilaDistrictCoords[key];
    if (!coords) continue; // skip districts without centroids

    if (!map.has(district)) {
      map.set(district, {
        district,
        lat: coords.lat,
        lng: coords.lng,
        cases: 0,
        diseases: new Map(),
      });
    }

    const entry = map.get(district);
    entry.cases += cases;
    entry.diseases.set(disease, (entry.diseases.get(disease) || 0) + cases);
  }

  return Array.from(map.values())
    .map((d) => ({
      district: d.district,
      lat: d.lat,
      lng: d.lng,
      cases: d.cases,
      diseaseBreakdown: Array.from(d.diseases.entries())
        .map(([name, value]) => ({ disease: name, cases: value }))
        .sort((a, b) => b.cases - a.cases),
    }))
    .sort((a, b) => b.cases - a.cases);
}

// ---------- Stats & insights ----------

export function buildConcentrationStats(points = [], barangayPoints = [], status = "confirmed") {
  const safeDistricts = Array.isArray(points) ? points : [];
  const safeBarangays = Array.isArray(barangayPoints) ? barangayPoints : [];
  return {
    totalCases: safeDistricts.reduce((sum, point) => sum + Number(point.totalCases || 0), 0),
    districtsWithCases: safeDistricts.filter((point) => Number(point.totalCases || 0) > 0).length,
    barangaysWithCases: safeBarangays.filter((point) => Number(point.cases || 0) > 0).length,
    selectedStatus: String(status || "confirmed").replace("_", " "),
  };
}

export function buildTopDistrictsFromPoints(points = [], limit = 5) {
  return [...(points || [])]
    .sort(
      (a, b) =>
        (b.totalCases ?? b.districtTotalCases ?? b.cases ?? 0) -
        (a.totalCases ?? a.districtTotalCases ?? a.cases ?? 0),
    )
    .slice(0, limit)
    .map((p) => ({
      name: p.district,
      cases: p.totalCases ?? p.districtTotalCases ?? p.cases ?? 0,
      concentrationShare: p.concentrationShare ?? 0,
    }));
}

export function buildTopDiseasesFromCases(caseRows = [], limit = 5) {
  const totals = new Map();

  for (const r of Array.isArray(caseRows) ? caseRows : []) {
    const disease = String(r?.disease || "Unknown").trim();
    const cases = Number(r?.cases ?? 0);

    if (!Number.isFinite(cases) || cases < 0) continue;
    totals.set(disease, (totals.get(disease) || 0) + cases);
  }

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, cases]) => ({ name, cases }));
}
