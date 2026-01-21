// YEARLY TIMELINE
export function buildYearlyTimelineData(cases = [], yearsToShow = 5) {
  const safe = Array.isArray(cases) ? cases : [];

  // Sum cases per year
  const yearlyMap = {};
  let maxYear = null;

  for (const r of safe) {
    const year = Number(r?.year);
    const count = Number(r?.cases ?? 0);
    if (!Number.isFinite(year) || year <= 0) continue;
    if (!Number.isFinite(count) || count < 0) continue;

    yearlyMap[year] = (yearlyMap[year] || 0) + count;
    if (maxYear === null || year > maxYear) maxYear = year;
  }

  if (maxYear === null) return [];

  const startYear = maxYear - (yearsToShow - 1);

  // Return continuous last N years, even if some years are missing
  const out = [];
  for (let y = startYear; y <= maxYear; y++) {
    out.push({
      // keep "date" so the chart can remain mostly the same
      date: `${y}-01-01`,
      cases: yearlyMap[y] || 0,
    });
  }

  return out;
}


// DISEASE CASE
export function buildDiseaseData(cases = []) {
  const safe = Array.isArray(cases) ? cases : [];
  const map = {};

  for (const r of safe) {
    const disease = String(r?.disease || "").trim();
    const count = Number(r?.cases ?? 0);
    if (!disease) continue;
    if (!Number.isFinite(count) || count < 0) continue;

    map[disease] = (map[disease] || 0) + count;
  }

  return Object.entries(map)
    .map(([disease, total]) => ({ disease, cases: total }))
    .sort((a, b) => b.cases - a.cases);
}

// DISTRICT CASE
export function buildDistrictCaseData(cases = []) {
  const safe = Array.isArray(cases) ? cases : [];
  const map = {};

  for (const r of safe) {
    const district = String(r?.district || "").trim();
    const count = Number(r?.cases ?? 0);
    if (!district) continue;
    if (!Number.isFinite(count) || count < 0) continue;

    map[district] = (map[district] || 0) + count;
  }

  return Object.entries(map)
    .map(([district, total]) => ({ district, cases: total }))
    .sort((a, b) => b.cases - a.cases);
}
