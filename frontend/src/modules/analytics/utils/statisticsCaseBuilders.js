export function buildDistrictStatisticsFromCases(caseRows = [], coveredDistricts = []) {
  const safe = Array.isArray(caseRows) ? caseRows : [];
  const districtMap = {};

  for (const value of Array.isArray(coveredDistricts) ? coveredDistricts : []) {
    const district = String(value || "").trim();
    if (!district || districtMap[district]) continue;
    districtMap[district] = {
      district,
      totalCases: 0,
      years: new Set(),
      diseases: new Set(),
    };
  }

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

  return Object.values(districtMap).map((d) => {
    const yearsCovered = d.years.size || 1;
    const avgCasesPerYear = d.totalCases / yearsCovered;

    return {
      district: d.district,
      totalCases: d.totalCases,

      yearsCovered: d.years.size,
      avgCasesPerYear: Number(avgCasesPerYear.toFixed(1)),
    };
  }).sort((a, b) => b.totalCases - a.totalCases);
}

// Year-over-year statistics.

function getMaxYearInData(caseRows = []) {
  const safe = Array.isArray(caseRows) ? caseRows : [];

  let maxYear = null;

  for (const r of safe) {
    const year = Number(r?.year);
    const cases = Number(r?.cases ?? 0);

    if (!Number.isFinite(year)) continue;
    if (!Number.isFinite(cases) || cases <= 0) continue;

    if (maxYear === null || year > maxYear) {
      maxYear = year;
    }
  }

  return maxYear;
}

function getCoverageMonthIndex(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

export function buildYoYCaseStatsFromCases(caseRows = [], coverage = {}) {
  const safe = Array.isArray(caseRows) ? caseRows : [];

  const coverageStartIndex = getCoverageMonthIndex(coverage?.coverageStart);
  const coverageEndIndex = getCoverageMonthIndex(coverage?.coverageEnd);
  const hasValidCoverage =
    coverageStartIndex !== null &&
    coverageEndIndex !== null &&
    coverageStartIndex <= coverageEndIndex;
  const thisYear = hasValidCoverage
    ? Math.floor(coverageEndIndex / 12)
    : getMaxYearInData(safe);
  if (!thisYear) {
    return {
      thisYear: null,
      lastYear: null,
      thisYearCases: 0,
      lastYearCases: 0,
      yoyPct: null,
      hasComparablePeriod: false,
      comparisonIsPartial: false,
    };
  }

  const lastYear = thisYear - 1;
  const comparisonStartMonth = hasValidCoverage && Math.floor(coverageStartIndex / 12) === thisYear
    ? (coverageStartIndex % 12) + 1
    : 1;
  const comparisonEndMonth = hasValidCoverage
    ? (coverageEndIndex % 12) + 1
    : 12;
  const previousPeriodStartIndex = lastYear * 12 + comparisonStartMonth - 1;
  const previousPeriodEndIndex = lastYear * 12 + comparisonEndMonth - 1;
  const hasComparablePeriod = !hasValidCoverage || (
    previousPeriodStartIndex >= coverageStartIndex &&
    previousPeriodEndIndex <= coverageEndIndex
  );

  let thisYearCases = 0;
  let lastYearCases = 0;

  for (const r of safe) {
    const year = Number(r?.year);
    const month = Number(r?.month);
    const cases = Number(r?.cases ?? 0);
    if (!Number.isFinite(year)) continue;
    if (!Number.isFinite(cases) || cases < 0) continue;

    if (hasValidCoverage) {
      if (!Number.isInteger(month) || month < comparisonStartMonth || month > comparisonEndMonth) {
        continue;
      }
    }

    if (year === thisYear) thisYearCases += cases;
    else if (year === lastYear && hasComparablePeriod) lastYearCases += cases;
  }

  const yoyPct =
    hasComparablePeriod && lastYearCases > 0
      ? ((thisYearCases - lastYearCases) / lastYearCases) * 100
      : null;

  return {
    thisYear,
    lastYear,
    thisYearCases,
    lastYearCases,
    yoyPct: yoyPct === null ? null : Number(yoyPct.toFixed(1)),
    hasComparablePeriod,
    comparisonIsPartial: comparisonStartMonth !== 1 || comparisonEndMonth !== 12,
  };
}

