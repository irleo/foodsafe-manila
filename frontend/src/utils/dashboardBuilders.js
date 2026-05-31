// YEARLY TIMELINE
export function buildYearlyTimelineData(cases = [], yearsToShow = 5, reports = []) {
  const safe = Array.isArray(cases) ? cases : [];
  const safeReports = Array.isArray(reports) ? reports : [];

  // Sum cases per year
  const yearlyMap = {};
  let maxYear = null;

  for (const r of safe) {
    const year = Number(r?.year);
    const count = Number(r?.cases ?? 0);
    if (!Number.isFinite(year) || year <= 0) continue;
    if (!Number.isFinite(count) || count < 0) continue;

    if (!yearlyMap[year]) {
      yearlyMap[year] = { officialCases: 0, citizenReports: 0 };
    }
    yearlyMap[year].officialCases += count;
    if (maxYear === null || year > maxYear) maxYear = year;
  }

  for (const r of safeReports) {
    const raw = r?.reportedAt ?? r?.reported_at ?? r?.createdAt;
    const d = raw ? new Date(raw) : null;
    const year = d && !Number.isNaN(d.getTime()) ? d.getFullYear() : null;
    const count = Number(r?.caseCount ?? 1);
    if (!Number.isFinite(year) || year <= 0) continue;
    if (!Number.isFinite(count) || count < 0) continue;

    if (!yearlyMap[year]) {
      yearlyMap[year] = { officialCases: 0, citizenReports: 0 };
    }
    yearlyMap[year].citizenReports += count;
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
      officialCases: yearlyMap[y]?.officialCases || 0,
      citizenReports: yearlyMap[y]?.citizenReports || 0,
      cases: yearlyMap[y]?.officialCases || 0,
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
