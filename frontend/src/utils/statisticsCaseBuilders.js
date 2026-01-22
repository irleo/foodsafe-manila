// src/utils/statisticsCaseBuilders.js

const percentChange = (current, previous) => {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
};

function percentile(sortedValues, p) {
  // p in [0,1], sortedValues ascending
  if (!sortedValues.length) return 0;
  const idx = (sortedValues.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedValues[lo];
  const w = idx - lo;
  return sortedValues[lo] * (1 - w) + sortedValues[hi] * w;
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

  // Build per-district stats first (without riskLevel)
  const districts = Object.values(districtMap).map((d) => {
    const yearsCovered = d.years.size || 1;
    const avgCasesPerYear = d.totalCases / yearsCovered;

    return {
      district: d.district,
      totalCases: d.totalCases,

      // Keep key names compatible if your table expects them
      incidents: d.years.size, // number of year buckets
      avgCasesPerEntry: Number(avgCasesPerYear.toFixed(1)), // meaning: avg cases/year

      diseasesCovered: d.diseases.size,
      yearsCovered: d.years.size,

      // Not available in official cases
      highCount: null,
      moderateCount: null,
      lowCount: null,
      avgSeverityScore: null,

      _riskMetric: avgCasesPerYear, // internal metric for classification
    };
  });

  // Percentile cutoffs (25th and 75th by default)
  const metrics = districts
    .map((d) => d._riskMetric)
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);

  const p25 = percentile(metrics, 0.25);
  const p75 = percentile(metrics, 0.75);

  // Assign riskLevel based on distribution
  const withRisk = districts.map((d) => {
    let riskLevel = "Moderate"; // middle band
    if (d._riskMetric <= p25) riskLevel = "Low";
    else if (d._riskMetric >= p75) riskLevel = "High";

    const { _riskMetric, ...rest } = d;
    return { ...rest, riskLevel };
  });

  return withRisk.sort((a, b) => b.totalCases - a.totalCases);
}

// Risk Level Donut Chart
export function buildRiskLevelDonutDataFromDistrictStats(districtStats = []) {
  const safe = Array.isArray(districtStats) ? districtStats : [];

  const totals = { High: 0, Moderate: 0, Low: 0 };

  for (const d of safe) {
    const risk = d?.riskLevel || "Moderate";
    const cases = Number(d?.totalCases ?? 0);
    if (!Number.isFinite(cases) || cases < 0) continue;

    if (totals[risk] === undefined) totals[risk] = 0;
    totals[risk] += cases;
  }

  const sum = totals.High + totals.Moderate + totals.Low || 1;

  return ["High", "Moderate", "Low"].map((risk) => ({
    risk,
    percentage: Number(((totals[risk] / sum) * 100).toFixed(1)),
  }));
}


export function buildYoYCaseStatsFromCases(caseRows = []) {
  const safe = Array.isArray(caseRows) ? caseRows : [];
  const thisYear = new Date().getFullYear();
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
