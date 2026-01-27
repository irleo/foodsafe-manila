function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Deterministic noise per year so it doesn't "randomly change" on reload
function pseudoNoiseFromYear(year) {
  const x = Math.sin(year * 999) * 10000;
  return x - Math.floor(x); // 0..1
}

/**
 * Builds {year, actual, predicted} rows.
 *
 * method:
 * - "yoy": predicted = last year's actual (baseline)
 * - "moving3": predicted = trailing 3-year average
 * - "combined": predicted = moving average adjusted by YoY trend
 */
export function buildYearlyPredictedVsActual(
  yearlyTimelineData = [], // [{date:"YYYY-01-01", cases:number}]
  method = "yoy"
) {
  const safe = Array.isArray(yearlyTimelineData) ? yearlyTimelineData : [];

  const actualRows = safe
    .map((r) => {
      const year = Number(String(r?.date ?? "").slice(0, 4));
      const actual = Number(r?.cases ?? 0);
      if (!Number.isFinite(year)) return null;
      if (!Number.isFinite(actual) || actual < 0) return null;
      return { year, actual };
    })
    .filter(Boolean)
    .sort((a, b) => a.year - b.year);

  if (!actualRows.length) return [];

  const byYear = new Map(actualRows.map((r) => [r.year, r.actual]));

  return actualRows.map(({ year, actual }) => {
    let predicted = actual;

    if (method === "yoy") {
      const last = byYear.get(year - 1);
      predicted = Number.isFinite(last) ? last : actual;

    } else if (method === "moving3") {
      const vals = [year - 1, year - 2, year - 3]
        .map((y) => byYear.get(y))
        .filter((v) => Number.isFinite(v));

      predicted = vals.length
        ? vals.reduce((s, v) => s + v, 0) / vals.length
        : actual;

    } else if (method === "combined") {
      // Step 1: trailing 3-year moving average (baseline)
      const maVals = [year - 1, year - 2, year - 3]
        .map((y) => byYear.get(y))
        .filter((v) => Number.isFinite(v));

      const ma = maVals.length
        ? maVals.reduce((s, v) => s + v, 0) / maVals.length
        : actual;

      // Step 2: YoY trend (direction)
      const prev = byYear.get(year - 1);
      const prevPrev = byYear.get(year - 2);

      const yoy =
        Number.isFinite(prev) && Number.isFinite(prevPrev) && prevPrev !== 0
          ? (prev - prevPrev) / prevPrev
          : 0;

      // Step 3: combined forecast
      predicted = ma * (1 + yoy);
    }

    return {
      year,
      actual: Math.round(actual),
      predicted: Math.round(predicted),
    };
  });
}

export function buildNextYearForecast(compareRows = []) {
  const safe = Array.isArray(compareRows) ? compareRows : [];
  const years = safe.map((r) => r.year).filter(Number.isFinite);
  if (!years.length) return null;

  const lastYear = Math.max(...years);
  const lastActual = safe.find((r) => r.year === lastYear)?.actual ?? 0;

  // YOY baseline: next = last year's actual
  return {
    targetYear: lastYear + 1,
    predicted: Number(lastActual) || 0,
    basisYear: lastYear,
  };
}
