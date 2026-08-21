export function buildMonthlyTimelineData(casesRows = []) {
  const map = {};

  const ensureMonthBucket = (year, month) => {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (!map[key]) {
      map[key] = {
        year,
        month,
        reportedCases: 0,
        suspectedCases: 0,
        confirmedCases: 0,
      };
    }
    return key;
  };

  for (const r of casesRows) {
    const year = Number(r?.year);
    const month = Number(r?.month);
    const cases = Number(r?.cases ?? 0);
    if (!Number.isFinite(year) || year <= 0) continue;
    if (!Number.isFinite(month) || month < 1 || month > 12) continue;
    if (!Number.isFinite(cases) || cases < 0) continue;
    const classification = String(r?.caseClassification || "")
      .trim()
      .toLowerCase();
    const seriesKey = {
      reported: "reportedCases",
      suspected: "suspectedCases",
      confirmed: "confirmedCases",
    }[classification];
    if (!seriesKey) continue;
    const key = ensureMonthBucket(year, month);
    map[key][seriesKey] += cases;
  }

  const buckets = Object.values(map);
  if (!buckets.length) return [];

  const monthIndices = buckets
    .map((b) => b.year * 12 + b.month - 1)
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  if (!monthIndices.length) return [];

  const start = monthIndices[0];
  const end = monthIndices[monthIndices.length - 1];
  const byMonthKey = new Map(buckets.map((b) => [`${b.year}-${b.month}`, b]));
  const rows = [];
  for (let idx = start; idx <= end; idx += 1) {
    const year = Math.floor(idx / 12);
    const month = (idx % 12) + 1;
    const key = `${year}-${month}`;
    const totals = byMonthKey.get(key) || {
      reportedCases: 0,
      suspectedCases: 0,
      confirmedCases: 0,
    };
    const totalCases =
      totals.reportedCases + totals.suspectedCases + totals.confirmedCases;
    rows.push({
      date: `${year}-${String(month).padStart(2, "0")}-01`,
      ...totals,
      totalCases,
      cases: totalCases,
    });
  }
  return rows;
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

export function buildDiseaseDistributionComparison(caseRows = []) {
  const safeRows = Array.isArray(caseRows) ? caseRows : [];
  const years = safeRows
    .map((row) => Number(row?.year))
    .filter((year) => Number.isFinite(year));

  if (years.length === 0) return [];

  const currentYear = Math.max(...years);
  const previousYear = currentYear - 1;
  const diseaseTotals = new Map();

  for (const row of safeRows) {
    const year = Number(row?.year);
    if (year !== currentYear && year !== previousYear) continue;

    const disease = String(row?.disease || "").trim();
    const cases = Number(row?.cases ?? 0);
    if (!disease || !Number.isFinite(cases) || cases < 0) continue;

    const totals = diseaseTotals.get(disease) || { current: 0, previous: 0 };
    if (year === currentYear) totals.current += cases;
    if (year === previousYear) totals.previous += cases;
    diseaseTotals.set(disease, totals);
  }

  const currentTotal = [...diseaseTotals.values()].reduce(
    (sum, totals) => sum + totals.current,
    0,
  );

  return [...diseaseTotals.entries()]
    .map(([disease, totals]) => {
      const absoluteChange = totals.current - totals.previous;
      const relativeChange =
        totals.previous > 0
          ? Number(((absoluteChange / totals.previous) * 100).toFixed(1))
          : null;

      return {
        disease,
        cases: totals.current,
        previousCases: totals.previous,
        absoluteChange,
        relativeChange,
        changeDirection:
          absoluteChange > 0 ? "increase" : absoluteChange < 0 ? "decrease" : "stable",
        share:
          currentTotal > 0
            ? Number(((totals.current / currentTotal) * 100).toFixed(1))
            : 0,
        currentYear,
        previousYear,
      };
    })
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

export function buildDiseaseTrendByMonth(caseRows = [], topN = 5, monthsBack = 60) {
  const safeRows = Array.isArray(caseRows) ? caseRows : [];
  const validRows = safeRows.filter((row) => {
    const year = Number(row?.year);
    const month = Number(row?.month);
    const cases = Number(row?.cases ?? 0);
    return (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      month >= 1 &&
      month <= 12 &&
      Number.isFinite(cases) &&
      cases >= 0 &&
      String(row?.disease || "").trim()
    );
  });

  if (validRows.length === 0) return { data: [], keys: [] };

  const monthIndices = validRows.map(
    (row) => Number(row.year) * 12 + Number(row.month) - 1,
  );
  const endIndex = Math.max(...monthIndices);
  const firstIndex = Math.min(...monthIndices);
  const startIndex = monthsBack
    ? Math.max(firstIndex, endIndex - (monthsBack - 1))
    : firstIndex;

  const diseaseTotals = new Map();
  for (const row of validRows) {
    const monthIndex = Number(row.year) * 12 + Number(row.month) - 1;
    if (monthIndex < startIndex || monthIndex > endIndex) continue;
    const disease = String(row.disease).trim();
    diseaseTotals.set(
      disease,
      (diseaseTotals.get(disease) || 0) + Number(row.cases),
    );
  }

  const keys = [...diseaseTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([disease]) => disease);
  if (keys.length === 0) return { data: [], keys: [] };

  const rows = [];
  const rowByIndex = new Map();
  for (let monthIndex = startIndex; monthIndex <= endIndex; monthIndex += 1) {
    const year = Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    const row = {
      date: `${year}-${String(month).padStart(2, "0")}-01`,
      year,
      month,
    };
    for (const disease of keys) row[disease] = 0;
    rows.push(row);
    rowByIndex.set(monthIndex, row);
  }

  for (const sourceRow of validRows) {
    const monthIndex = Number(sourceRow.year) * 12 + Number(sourceRow.month) - 1;
    const disease = String(sourceRow.disease).trim();
    const targetRow = rowByIndex.get(monthIndex);
    if (!targetRow || !keys.includes(disease)) continue;
    targetRow[disease] += Number(sourceRow.cases);
  }

  return { data: rows, keys };
}
