import { manilaDistrictCoords, toManilaDistrictKey } from "../constants/manilaDistrictCoords";

// ---------- Risk logic (shared with legend) ----------

export function getRiskBand(cases) {
  if (cases >= 31) return "Critical";
  if (cases >= 16) return "High";
  if (cases >= 6) return "Medium";
  return "Low";
}

export function getRiskColor(cases) {
  const band = getRiskBand(cases);
  if (band === "Critical") return "#ef4444";
  if (band === "High") return "#f97316";
  if (band === "Medium") return "#eab308";
  return "#22c55e";
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

    const key = toManilaDistrictKey(district);
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
      risk: getRiskBand(d.cases),
      diseaseBreakdown: Array.from(d.diseases.entries())
        .map(([name, value]) => ({ disease: name, cases: value }))
        .sort((a, b) => b.cases - a.cases),
    }))
    .sort((a, b) => b.cases - a.cases);
}

// ---------- Stats & insights ----------

export function buildRiskStatsFromDistrictPoints(points = []) {
  const stats = { Low: 0, Medium: 0, High: 0, Critical: 0 };
  for (const p of Array.isArray(points) ? points : []) {
    stats[getRiskBand(p.cases)] += 1;
  }
  return stats;
}

export function buildTopDistrictsFromPoints(points = [], limit = 5) {
  return [...(points || [])]
    .sort((a, b) => (b.cases ?? 0) - (a.cases ?? 0))
    .slice(0, limit)
    .map((p) => ({ name: p.district, cases: p.cases ?? 0 }));
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
