export function buildYearlyTimelineData(casesRows = []) {
  const map = {};
  for (const r of casesRows) {
    const year = Number(r?.year);
    const cases = Number(r?.cases ?? 0);
    if (!Number.isFinite(year) || year <= 0) continue;
    if (!Number.isFinite(cases) || cases < 0) continue;
    map[year] = (map[year] || 0) + cases;
  }

  // Use `date` so you can reuse your line chart component if needed
  return Object.entries(map)
    .map(([year, total]) => ({ date: `${year}-01-01`, cases: total }))
    .sort((a, b) => (a.date > b.date ? 1 : -1));
}

export function buildDiseaseData(caseRows = []) {
  const map = {};
  for (const r of caseRows) {
    const disease = String(r?.disease || "").trim();
    const cases = Number(r?.cases ?? 0);
    if (!disease) continue;
    if (!Number.isFinite(cases) || cases < 0) continue;
    map[disease] = (map[disease] || 0) + cases;
  }

  // If your chart expects { disease, cases } (your new standard)
  return Object.entries(map)
    .map(([disease, total]) => ({ disease, cases: total }))
    .sort((a, b) => b.cases - a.cases);
}

export function buildDistrictDataFromCases(caseRows = []) {
  const map = {};
  for (const r of caseRows) {
    const district = String(r?.district || "").trim();
    const cases = Number(r?.cases ?? 0);
    if (!district) continue;
    if (!Number.isFinite(cases) || cases < 0) continue;
    map[district] = (map[district] || 0) + cases;
  }

  return Object.entries(map)
    .map(([district, total]) => ({ district, cases: total }))
    .sort((a, b) => b.cases - a.cases);
}

// Donut Chart
export function buildBurdenTierDonutData(rows = [], thresholds = { high: 50, moderate: 20 }) {
  const out = { High: 0, Moderate: 0, Low: 0 };

  for (const r of rows) {
    const cases = Number(r?.cases ?? 0);
    if (!Number.isFinite(cases) || cases < 0) continue;

    if (cases >= thresholds.high) out.High += cases;
    else if (cases >= thresholds.moderate) out.Moderate += cases;
    else out.Low += cases;
  }

  const total = out.High + out.Moderate + out.Low || 1;

  return ["High", "Moderate", "Low"].map((tier) => ({
    severity: tier, // keep key so your existing donut component works unchanged
    percentage: Number(((out[tier] / total) * 100).toFixed(1)),
  }));
}


// Disease Trend

function yearFromRow(r) {
  const y = Number(r?.year);
  return Number.isFinite(y) ? y : null;
}

export function buildDiseaseTrendByYear(caseRows = [], topN = 5, yearsBack = 10) {
  const safe = Array.isArray(caseRows) ? caseRows : [];

  // 1) Find latest year available
  const years = safe.map(yearFromRow).filter((y) => y !== null).sort((a, b) => a - b);
  if (!years.length) return { data: [], keys: [] };

  const endYear = years[years.length - 1];
  const startYear = yearsBack ? endYear - (yearsBack - 1) : years[0];

  // 2) Total cases per disease (within year window)
  const diseaseTotals = {};
  for (const r of safe) {
    const year = yearFromRow(r);
    if (year === null || year < startYear || year > endYear) continue;

    const disease = String(r?.disease || "").trim();
    const cases = Number(r?.cases ?? 0);
    if (!disease) continue;
    if (!Number.isFinite(cases) || cases < 0) continue;

    diseaseTotals[disease] = (diseaseTotals[disease] || 0) + cases;
  }

  const keys = Object.entries(diseaseTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([disease]) => disease);

  if (!keys.length) return { data: [], keys: [] };

  // 3) Build year buckets with zeros for each disease key
  const yearSet = new Set();
  for (const y of years) if (y >= startYear && y <= endYear) yearSet.add(y);
  const yearList = Array.from(yearSet).sort((a, b) => a - b);

  const rows = yearList.map((y) => {
    const base = { year: y };
    for (const k of keys) base[k] = 0;
    return base;
  });

  const yearIndex = new Map(rows.map((row, i) => [row.year, i]));

  // 4) Fill in cases per disease per year
  for (const r of safe) {
    const year = yearFromRow(r);
    if (year === null || year < startYear || year > endYear) continue;

    const disease = String(r?.disease || "").trim();
    if (!keys.includes(disease)) continue;

    const cases = Number(r?.cases ?? 0);
    if (!Number.isFinite(cases) || cases < 0) continue;

    const idx = yearIndex.get(year);
    if (idx === undefined) continue;

    rows[idx][disease] += cases;
  }

  return { data: rows, keys, startYear, endYear };
}
