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
 * - "yoy": predicted = last year's actual (simple baseline)
 * - "moving3": predicted = avg of last 3 years actual
 * - "biased": predicted = actual * (1 +/- percent) as a placeholder (demo)
 */
export function buildYearlyPredictedVsActual(
  yearlyTimelineData = [], // [{date:"YYYY-01-01", cases:number}]
  method = "yoy",
  placeholderPercent = 0.12 // 12% placeholder swing for "biased"
) {
  const safe = Array.isArray(yearlyTimelineData) ? yearlyTimelineData : [];

  // Convert to {year, actual}
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

  return actualRows.map((row, idx) => {
    const { year, actual } = row;

    let predicted = actual;

    if (method === "yoy") {
      const last = byYear.get(year - 1);
      predicted = Number.isFinite(last) ? last : actual; // fallback for first year
    } else if (method === "moving3") {
      const vals = [year - 1, year - 2, year - 3]
        .map((y) => byYear.get(y))
        .filter((v) => Number.isFinite(v));
      predicted = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : actual;
    } else if (method === "biased") {
      // deterministic +/- swing around actual for demo
      const noise = pseudoNoiseFromYear(year); // 0..1
      const sign = noise >= 0.5 ? 1 : -1;
      const factor = 1 + sign * clamp(placeholderPercent, 0, 0.5);
      predicted = actual * factor;
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
