export const FORECAST_MODEL_OPTIONS = [
  { value: "best", label: "Best-performing method" },
  { value: "prophet", label: "Trend-based method (Prophet)" },
  { value: "seasonal_naive", label: "Same month last year" },
];

export function modelLabel(model) {
  if (model === "prophet") return "Trend-based method (Prophet)";
  if (model === "seasonal_naive") return "Same month last year";
  if (model === "mixed") return "Best method for each district";
  return "Unavailable";
}

function finiteNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeForecastPoint(point) {
  if (!point) return null;
  return {
    year: point.year ?? point.targetYear,
    month: point.month ?? point.targetMonth,
    week: point.week ?? point.targetWeek,
    date: point.date ?? null,
    predicted: finiteNumber(point.predictedCases ?? point.predicted),
    lower: finiteNumber(point.lowerBound ?? point.lower),
    upper: finiteNumber(point.upperBound ?? point.upper),
    isPrimaryTarget: Boolean(point.isPrimaryTarget),
    expectedStatus: point.expectedStatus || null,
    threshold: point.threshold || null,
  };
}

function districtModelKey(district, mode) {
  if (mode === "prophet") return "prophet";
  if (mode === "seasonal_naive") return "seasonal_naive";
  return district?.operationalModel || district?.selectedModel || null;
}

export function getDistrictScope(district, mode) {
  if (!district) return null;
  const resolvedModel = districtModelKey(district, mode);
  const nested = resolvedModel === "prophet"
    ? district.models?.prophet
    : resolvedModel === "seasonal_naive"
      ? district.models?.seasonalNaive
      : null;
  const legacyProphet = !district.models && mode !== "seasonal_naive"
    ? district
    : null;
  const model = nested || legacyProphet;
  if (!model) {
    return {
      historicalSeries: district.historicalSeries || [],
      backtestSeries: [],
      forecast: [],
      status: "unavailable",
      resolvedModel,
      modelComparison: district.modelComparison || null,
    };
  }

  return {
    ...model,
    historicalSeries: district.historicalSeries || [],
    resolvedModel: legacyProphet ? "prophet" : resolvedModel,
    modelComparison: district.modelComparison || null,
  };
}

function addToPeriod(map, row, fields) {
  const year = row?.year;
  const period = row?.week ?? row?.month;
  if (year == null || period == null) return;
  const key = `${year}-${period}`;
  const entry = map.get(key) || { year, month: row?.month, week: row?.week, date: row?.date };
  for (const [name, value] of Object.entries(fields)) {
    const number = finiteNumber(value);
    if (number != null) entry[name] = (entry[name] || 0) + number;
  }
  map.set(key, entry);
}

function buildLegacyWholeManila(districts, mode = "prophet") {
  const safeDistricts = Array.isArray(districts) ? districts : [];
  const historical = new Map();
  const backtest = new Map();
  const forecast = new Map();
  let successfulDistricts = 0;

  for (const district of safeDistricts) {
    const scope = getDistrictScope(district, mode);
    for (const row of district.historicalSeries || []) {
      addToPeriod(historical, row, { cases: row.cases });
    }
    for (const row of scope?.backtestSeries || []) {
      addToPeriod(backtest, row, {
        actualCases: row.actualCases,
        predictedCases: row.predictedCases,
        districtCount: 1,
      });
    }
    const primary = scope?.forecast?.find((point) => point.isPrimaryTarget);
    if (scope?.status === "success" && primary) {
      successfulDistricts += 1;
      addToPeriod(forecast, primary, {
        predictedCases: primary.predictedCases,
      });
      const key = `${primary.year}-${primary.week ?? primary.month}`;
      forecast.set(key, { ...forecast.get(key), isPrimaryTarget: true });
    }
  }

  const complete = safeDistricts.length > 0 && successfulDistricts === safeDistricts.length;
  return {
    historicalSeries: [...historical.values()],
    backtestSeries: complete
      ? [...backtest.values()].filter((row) => row.districtCount === safeDistricts.length)
      : [],
    forecast: complete ? [...forecast.values()] : [],
    resolvedModel: mode,
    coverage: {
      totalDistricts: safeDistricts.length,
      successfulDistricts,
      completeCityForecast: complete,
    },
  };
}

export function getWholeManilaScope(payload, mode) {
  const whole = payload?.wholeManila;
  if (whole?.forecast && mode === "best") {
    return { ...whole, resolvedModel: "mixed" };
  }
  const scope = mode === "prophet"
    ? whole?.prophet
    : mode === "seasonal_naive"
      ? whole?.seasonalNaive
      : whole?.best;
  if (scope) {
    const bestModels = new Set(
      (payload?.districts || [])
        .map((district) => district.operationalModel || district.selectedModel)
        .filter(Boolean),
    );
    return {
      ...scope,
      resolvedModel: mode === "best"
        ? bestModels.size === 1 ? [...bestModels][0] : "mixed"
        : mode,
    };
  }
  return buildLegacyWholeManila(payload?.districts || [], mode);
}

export function getPredictionScope(payload, districtKey, mode) {
  if (districtKey === "manila") return getWholeManilaScope(payload, mode);
  const district = (payload?.districts || []).find(
    (item) => item.districtKey === districtKey || item.district === districtKey,
  );
  return getDistrictScope(district, mode);
}

export function buildPredictionRows(scope) {
  const byPeriod = new Map();
  for (const row of scope?.historicalSeries || []) {
    const period = row.week ?? row.month;
    const key = `${row.year}-${period}`;
    byPeriod.set(key, {
      year: row.year,
      month: row.month,
      week: row.week,
      date: row.date,
      actual: finiteNumber(row.cases ?? row.actualCases ?? row.actual),
      isForecast: false,
    });
  }
  for (const row of scope?.backtestSeries || []) {
    const period = row.week ?? row.month;
    const key = `${row.year}-${period}`;
    byPeriod.set(key, {
      ...(byPeriod.get(key) || { year: row.year, month: row.month, week: row.week, date: row.date }),
      actual: finiteNumber(row.actualCases ?? row.actual),
      predicted: finiteNumber(row.predictedCases ?? row.predicted),
      lower: finiteNumber(row.lowerBound ?? row.lower),
      upper: finiteNumber(row.upperBound ?? row.upper),
      signedError: finiteNumber(row.signedError),
      absoluteError: finiteNumber(row.absoluteError),
      isForecast: false,
      model: scope?.resolvedModel,
    });
  }
  const target = normalizeForecastPoint(
    scope?.forecast?.find((point) => point.isPrimaryTarget)
      || scope?.forecast?.[0]
      || scope?.nextForecast,
  );
  if (target?.predicted != null) {
    const period = target.week ?? target.month;
    const key = `${target.year}-${period}`;
    byPeriod.set(key, {
      ...(byPeriod.get(key) || { year: target.year, month: target.month, week: target.week, date: target.date }),
      actual: null,
      predicted: target.predicted,
      lower: target.lower,
      upper: target.upper,
      isForecast: true,
      isPrimaryTarget: true,
      model: scope?.resolvedModel,
    });
  }
  return [...byPeriod.values()].sort(
    (a, b) => a.year * 100 + (a.week ?? a.month) - (b.year * 100 + (b.week ?? b.month)),
  );
}

export function getPrimaryForecast(scope) {
  return normalizeForecastPoint(
    scope?.forecast?.find((point) => point.isPrimaryTarget)
      || scope?.forecast?.[0]
      || scope?.nextForecast,
  );
}
