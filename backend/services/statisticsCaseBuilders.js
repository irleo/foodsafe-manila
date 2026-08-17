const percentChange = (current, previous) => {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
};

export function getYearRange(caseRows = []) {
  const safe = Array.isArray(caseRows) ? caseRows : [];
  let min = null;
  let max = null;

  for (const r of safe) {
    const year = Number(r?.year);
    const cases = Number(r?.cases ?? 0);

    if (!Number.isFinite(year)) continue;
    if (!Number.isFinite(cases) || cases < 0) continue;

    if (min === null || year < min) min = year;
    if (max === null || year > max) max = year;
  }

  return { min, max };
}

export function getMaxYearInData(caseRows = []) {
  const safe = Array.isArray(caseRows) ? caseRows : [];
  let maxYear = null;

  for (const r of safe) {
    const year = Number(r?.year);
    const cases = Number(r?.cases ?? 0);

    if (!Number.isFinite(year)) continue;
    if (!Number.isFinite(cases) || cases <= 0) continue;

    if (maxYear === null || year > maxYear) maxYear = year;
  }

  return maxYear;
}

export function buildDistrictStatisticsFromCases(caseRows = []) {
  const safe = Array.isArray(caseRows) ? caseRows : [];
  const districtMap = {};

  for (const r of safe) {
    const district = String(r?.district || "").trim();
    const disease = String(r?.disease || "").trim();
    const year = Number(r?.year);
    const cases = Number(r?.cases ?? 0);

    if (!district) continue;
    if (!Number.isFinite(cases) || cases < 0) continue;

    if (!districtMap[district]) {
      districtMap[district] = {
        district,
        totalCases: 0,
        years: new Set(),
        diseases: new Set(),
      };
    }

    districtMap[district].totalCases += cases;
    if (Number.isFinite(year)) districtMap[district].years.add(year);
    if (disease) districtMap[district].diseases.add(disease);
  }

  const districts = Object.values(districtMap).map((d) => {
    const yearsCovered = d.years.size || 1;
    const avgCasesPerYear = d.totalCases / yearsCovered;

    return {
      district: d.district,
      totalCases: d.totalCases,
      yearsCovered: d.years.size,
      avgCasesPerYear: Number(avgCasesPerYear.toFixed(1)),
      diseasesCovered: d.diseases.size,

    };
  });
  return districts.sort((a, b) => b.totalCases - a.totalCases);
}

export function buildYoYCaseStatsFromCases(caseRows = []) {
  const safe = Array.isArray(caseRows) ? caseRows : [];

  const thisYear = getMaxYearInData(safe);
  if (!thisYear) {
    return {
      thisYear: null,
      lastYear: null,
      thisYearCases: 0,
      lastYearCases: 0,
      yoyPct: null,
    };
  }

  const lastYear = thisYear - 1;

  let thisYearCases = 0;
  let lastYearCases = 0;

  for (const r of safe) {
    const year = Number(r?.year);
    const cases = Number(r?.cases ?? 0);
    if (!Number.isFinite(year)) continue;
    if (!Number.isFinite(cases) || cases < 0) continue;

    if (year === thisYear) thisYearCases += cases;
    else if (year === lastYear) lastYearCases += cases;
  }

  const yoyPct = percentChange(thisYearCases, lastYearCases);

  return {
    thisYear,
    lastYear,
    thisYearCases,
    lastYearCases,
    yoyPct: yoyPct === null ? null : Number(yoyPct.toFixed(1)),
  };
}
