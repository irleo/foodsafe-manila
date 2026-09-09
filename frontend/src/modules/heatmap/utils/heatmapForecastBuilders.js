import { normalizeDistrictKey } from "../constants/manilaDistrictCoords";

function finiteNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function getPrimaryDistrictForecast(district) {
  const prophet = district?.models?.prophet;
  const forecasts = Array.isArray(prophet?.forecast)
    ? prophet.forecast
    : Array.isArray(district?.forecast)
      ? district.forecast
      : [];
  const target = forecasts.find((point) => point.isPrimaryTarget)
    || (district?.operationalModel === "prophet" ? district?.nextForecast : null)
    || forecasts[0]
    || null;

  const predictedCases = finiteNumber(target?.predictedCases ?? target?.predicted);
  const status = prophet?.status || district?.status;
  if (status !== "success" || predictedCases == null) return null;

  return {
    year: finiteNumber(target?.year),
    month: finiteNumber(target?.month),
    predictedCases: Math.max(0, predictedCases),
    lowerBound: finiteNumber(target?.lowerBound ?? target?.lower),
    upperBound: finiteNumber(target?.upperBound ?? target?.upper),
    expectedStatus: target?.expectedStatus || target?.threshold?.classification || null,
    threshold: target?.threshold || null,
    model: "prophet",
  };
}

export function buildForecastDistrictPoints(predictionRun) {
  const districts = Array.isArray(predictionRun?.payload?.districts)
    ? predictionRun.payload.districts
    : [];

  const points = districts.flatMap((district) => {
    const forecast = getPrimaryDistrictForecast(district);
    if (!forecast) return [];
    return [{
      district: district.district,
      districtKey: district.districtKey || normalizeDistrictKey(district.district),
      cases: forecast.predictedCases,
      ...forecast,
    }];
  });
  const total = points.reduce((sum, point) => sum + point.predictedCases, 0);

  return points
    .map((point) => ({
      ...point,
      concentrationShare: total > 0
        ? Number(((point.predictedCases / total) * 100).toFixed(1))
        : 0,
    }))
    .sort((a, b) => b.predictedCases - a.predictedCases);
}

export function buildForecastComparison(actualDistricts = [], forecastDistricts = []) {
  const actualByDistrict = new Map(
    (Array.isArray(actualDistricts) ? actualDistricts : []).map((district) => [
      district.districtKey || normalizeDistrictKey(district.district),
      Number(district.totalCases ?? district.cases ?? 0),
    ]),
  );

  return (Array.isArray(forecastDistricts) ? forecastDistricts : []).map((forecast) => {
    const actualCases = actualByDistrict.get(forecast.districtKey) || 0;
    const difference = Number((forecast.predictedCases - actualCases).toFixed(1));
    const percentChange = actualCases > 0
      ? Number(((difference / actualCases) * 100).toFixed(1))
      : null;

    return {
      ...forecast,
      actualCases,
      difference,
      percentChange,
      trend: difference > 0 ? "increasing" : difference < 0 ? "declining" : "unchanged",
    };
  });
}

export function formatForecastPeriod(year, month) {
  if (!Number.isFinite(Number(year)) || !Number.isFinite(Number(month))) return "Unavailable";
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(year), Number(month) - 1, 1)));
}
