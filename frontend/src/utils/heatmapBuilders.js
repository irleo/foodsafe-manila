// src/utils/heatmapBuilders.js

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateOnlyISO(d) {
  if (!d) return "—";
  return d.toISOString().slice(0, 10);
}

// Legend thresholds (same logic as your LegendCard)
export function getRiskBand(cases) {
  if (cases >= 31) return "Critical";
  if (cases >= 16) return "High";
  if (cases >= 6) return "Medium";
  return "Low";
}

export function getRiskColor(cases) {
  const band = getRiskBand(cases);
  if (band === "Critical") return "#ef4444"; // red
  if (band === "High") return "#f97316"; // orange
  if (band === "Medium") return "#eab308"; // yellow
  return "#22c55e"; // green
}

// Circle grows as cases rise (predictable scaling, capped)
export function getRadius(cases) {
  const r = 8 + Math.sqrt(Math.max(1, cases)) * 4;
  return Math.min(34, Math.max(10, r));
}

/**
 * Groups reports into one point per district.
 * - cases = number of reports (until you add a true case count field)
 * - latest = most recent reportedAt/date in the district
 * - illnessBreakdown = array of illnesses within the district
 */
export function buildDistrictHeatmapPoints(reports = []) {
  const map = {};

  for (const r of Array.isArray(reports) ? reports : []) {
    const district = r?.location?.district;
    const coords = r?.location?.coordinates;

    // IMPORTANT: use == null checks so 0 is not treated as missing
    if (!district || coords?.lat == null || coords?.lng == null) continue;

    const illness = r?.illness || "Unknown";
    const d = toDate(r?.reportedAt || r?.date);

    // Until you add a real field (cases / caseCount), 1 report = 1 case
    const cases = Number(r?.cases ?? r?.caseCount ?? 1) || 1;

    if (!map[district]) {
      map[district] = {
        district,
        lat: coords.lat,
        lng: coords.lng,
        cases: 0,
        latestDate: null, // Date
        illnesses: {}, // illness -> { illness, cases, latestDate }
      };
    }

    const entry = map[district];
    entry.cases += cases;

    if (d && (!entry.latestDate || d > entry.latestDate)) entry.latestDate = d;

    if (!entry.illnesses[illness]) {
      entry.illnesses[illness] = { illness, cases: 0, latestDate: null };
    }

    entry.illnesses[illness].cases += cases;
    if (
      d &&
      (!entry.illnesses[illness].latestDate || d > entry.illnesses[illness].latestDate)
    ) {
      entry.illnesses[illness].latestDate = d;
    }
  }

  return Object.values(map)
    .map((d) => ({
      district: d.district,
      lat: d.lat,
      lng: d.lng,
      cases: d.cases,
      risk: getRiskBand(d.cases),
      latest: dateOnlyISO(d.latestDate),
      illnessBreakdown: Object.values(d.illnesses)
        .map((x) => ({
          illness: x.illness,
          cases: x.cases,
          latest: dateOnlyISO(x.latestDate),
        }))
        .sort((a, b) => b.cases - a.cases),
    }))
    .sort((a, b) => b.cases - a.cases);
}

/**
 * Counts how many districts fall into each risk band (based on district total cases).
 */
export function buildRiskStatsFromDistrictPoints(points = []) {
  const stats = { Low: 0, Medium: 0, High: 0, Critical: 0 };
  for (const p of Array.isArray(points) ? points : []) {
    stats[getRiskBand(p.cases)] += 1;
  }
  return stats;
}


// --- filters + builders for heatmap modes ---

export function getUniqueDistricts(reports = []) {
  const set = new Set();
  for (const r of Array.isArray(reports) ? reports : []) {
    const d = r?.location?.district;
    if (d) set.add(d);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function getUniqueIllnesses(reports = []) {
  const set = new Set();
  for (const r of Array.isArray(reports) ? reports : []) {
    const i = r?.illness;
    if (i) set.add(i);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * Filters raw reports by district and/or illness.
 * Pass "All" or empty to mean "no filter".
 */
export function filterReports(reports = [], { district = "All", illness = "All" } = {}) {
  const list = Array.isArray(reports) ? reports : [];
  return list.filter((r) => {
    const rd = r?.location?.district;
    const ri = r?.illness;

    const districtOk = district === "All" || !district ? true : rd === district;
    const illnessOk = illness === "All" || !illness ? true : ri === illness;

    return districtOk && illnessOk;
  });
}
