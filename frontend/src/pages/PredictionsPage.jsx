import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { notify } from "../utils/toast";
import { fetchLatestPredictions, refreshPredictions } from "../api/predictions";

import YearlyActualVsPredictedLineChart from "../components/charts/YearlyActualVsPredictedLineChart";
import YearlyPredictionErrorBarChart from "../components/charts/YearlyPredictionErrorBarChart";

function riskCardClass(level) {
  if (level === "high")
    return "border-2 rounded-xl p-6 bg-red-100 text-red-700 border-red-300";
  if (level === "medium")
    return "border-2 rounded-xl p-6 bg-yellow-100 text-yellow-700 border-yellow-300";
  if (level === "insufficient")
    return "border-2 rounded-xl p-6 bg-gray-100 text-gray-700 border-gray-300";
  return "border-2 rounded-xl p-6 bg-green-100 text-green-700 border-green-300";
}

function formatMonth(value) {
  if (value == null) return "—";

  const monthNumber = Number(value);

  if (!Number.isFinite(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return String(value);
  }

  return new Date(2026, monthNumber - 1, 1).toLocaleString(undefined, {
    month: "long",
  });
}

function formatYearMonth(year, month) {
  if (year == null || month == null) return "—";
  return `${formatMonth(month)} ${year}`;
}

function getRowLabel(row) {
  if (!row) return "—";

  if (row.year != null && row.month != null) {
    return formatYearMonth(row.year, row.month);
  }

  if (row.targetYear != null && row.targetMonth != null) {
    return formatYearMonth(row.targetYear, row.targetMonth);
  }

  if (row.period) return row.period;
  if (row.date) return row.date;
  if (row.ds) return row.ds;
  if (row.year != null) return row.year;

  return "—";
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeForecastPoint(point) {
  if (!point) return null;
  return {
    year: point.year ?? point.targetYear,
    month: point.month ?? point.targetMonth,
    predicted: toFiniteNumber(point.predictedCases ?? point.predicted),
    lower: toFiniteNumber(point.lowerBound ?? point.lower),
    upper: toFiniteNumber(point.upperBound ?? point.upper),
    isPrimaryTarget: Boolean(point.isPrimaryTarget),
  };
}

function hasPredictionResult(row) {
  return (
    Number.isFinite(Number(row?.actual)) &&
    Number.isFinite(Number(row?.predicted))
  );
}

function mergePeriodRow(map, year, month, patch) {
  if (year == null || month == null) return;
  const key = `${year}-${month}`;
  map.set(key, {
    ...(map.get(key) || { year, month }),
    ...patch,
  });
}

function buildRowsFromForecast(scope) {
  const hist = Array.isArray(scope?.historicalSeries)
    ? scope.historicalSeries
    : [];
  const backtest = Array.isArray(scope?.backtestSeries)
    ? scope.backtestSeries
    : [];
  const fc = Array.isArray(scope?.forecast) ? scope.forecast : [];
  const byPeriod = new Map();

  for (const r of hist) {
    mergePeriodRow(byPeriod, r.year, r.month, {
      actual: toFiniteNumber(r.cases ?? r.actualCases ?? r.actual),
      isForecast: false,
    });
  }

  for (const r of backtest) {
    mergePeriodRow(byPeriod, r.year, r.month, {
      actual: toFiniteNumber(r.actualCases ?? r.actual),
      predicted: toFiniteNumber(r.predictedCases ?? r.predicted),
      lower: toFiniteNumber(r.lowerBound ?? r.lower),
      upper: toFiniteNumber(r.upperBound ?? r.upper),
      isForecast: false,
    });
  }

  const target = normalizeForecastPoint(
    fc.find((r) => r.isPrimaryTarget) || fc[0] || scope?.nextForecast,
  );

  if (target?.predicted != null) {
    mergePeriodRow(byPeriod, target.year, target.month, {
      actual: null,
      predicted: target.predicted,
      lower: target.lower,
      upper: target.upper,
      isPrimaryTarget: true,
      isForecast: true,
    });
  }

  return [...byPeriod.values()].sort(
    (a, b) => a.year * 100 + a.month - (b.year * 100 + b.month),
  );
}

function addToPeriod(map, year, month, fields) {
  if (year == null || month == null) return;
  const key = `${year}-${month}`;
  const entry = map.get(key) || { year, month };
  for (const [name, value] of Object.entries(fields)) {
    const n = Number(value);
    if (Number.isFinite(n)) entry[name] = (entry[name] ?? 0) + n;
  }
  map.set(key, entry);
}

function buildCityForecast(districts = []) {
  const historical = new Map();
  const backtest = new Map();
  const forecast = new Map();

  for (const district of Array.isArray(districts) ? districts : []) {
    for (const r of district.historicalSeries || []) {
      addToPeriod(historical, r.year, r.month, { cases: r.cases });
    }
    for (const r of district.backtestSeries || []) {
      addToPeriod(backtest, r.year, r.month, {
        actualCases: r.actualCases ?? r.actual,
        predictedCases: r.predictedCases ?? r.predicted,
        lowerBound: r.lowerBound ?? r.lower,
        upperBound: r.upperBound ?? r.upper,
      });
    }
    for (const r of district.forecast || []) {
      if (!r.isPrimaryTarget) continue;
      addToPeriod(forecast, r.year, r.month, {
        predictedCases: r.predictedCases ?? r.predicted,
        lowerBound: r.lowerBound ?? r.lower,
        upperBound: r.upperBound ?? r.upper,
      });
      const key = `${r.year}-${r.month}`;
      forecast.set(key, { ...forecast.get(key), isPrimaryTarget: true });
    }
  }

  return {
    historicalSeries: [...historical.values()],
    backtestSeries: [...backtest.values()],
    forecast: [...forecast.values()],
  };
}

function calculateMetrics(rows) {
  const predictionRows = rows.filter(
    (row) => !row.isForecast && hasPredictionResult(row),
  );
  if (!predictionRows.length) return null;

  const squaredErrors = [];
  const pctErrors = [];

  for (const row of predictionRows) {
    const actual = Number(row.actual);
    const predicted = Number(row.predicted);
    const error = actual - predicted;
    squaredErrors.push(error * error);
    if (actual > 0) pctErrors.push(Math.abs(error) / actual);
  }

  const rmse = Math.sqrt(
    squaredErrors.reduce((sum, value) => sum + value, 0) / squaredErrors.length,
  );
  const mape = pctErrors.length
    ? (pctErrors.reduce((sum, value) => sum + value, 0) / pctErrors.length) *
      100
    : null;

  return {
    rmse: Math.round(rmse),
    mape: mape == null ? null : Number(mape.toFixed(1)),
  };
}

export default function Predictions() {
  const { auth } = useAuth();
  const token = auth?.accessToken;
  const role = auth?.role;
  const isAdmin = role === "admin";

  const [isGenerating, setIsGenerating] = useState(false);
  const [run, setRun] = useState(null);
  const [selectedChartDistrict, setSelectedChartDistrict] = useState("manila");
  const [selectedErrorDistrict, setSelectedErrorDistrict] = useState("manila");
  const [selectedHistoryDistrict, setSelectedHistoryDistrict] =
    useState("manila");
  const [historyPage, setHistoryPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [emptyMsg, setEmptyMsg] = useState("");

  useEffect(() => {
    if (!token) return;

    let isMounted = true;

    (async () => {
      try {
        setLoading(true);
        setEmptyMsg("");

        const data = await fetchLatestPredictions(token);

        if (!isMounted) return;

        if (data?.hasPrediction === false) {
          setRun(null);
          setEmptyMsg(
            data?.message ||
              "No saved monthly prediction run found. Upload official case data or run prediction refresh.",
          );
          return;
        }

        setRun(data);
      } catch (e) {
        if (!isMounted) return;

        const msg = e?.message || "Failed to load saved forecast";
        setRun(null);
        setEmptyMsg(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const onRefresh = () => {
    const doRefresh = async () => {
      if (!token) throw new Error("Sign in to refresh predictions.");
      if (!isAdmin) throw new Error("Admin access required to refresh.");

      setIsGenerating(true);

      try {
        await refreshPredictions(token);
        const data = await fetchLatestPredictions(token);
        if (data?.hasPrediction === false)
          throw new Error(data?.message || "No prediction run created.");
        setRun(data);
        setSelectedChartDistrict("manila");
        setSelectedErrorDistrict("manila");
        setSelectedHistoryDistrict("manila");

        setEmptyMsg("");

        return data;
      } finally {
        setIsGenerating(false);
      }
    };

    notify.promise(doRefresh(), {
      loading: "Refreshing saved forecast…",
      success: "Forecast refreshed",
      error: (e) => e?.message || "Failed to refresh forecast",
    });
  };

  const districtOptions = useMemo(() => {
    const districts = run?.payload?.districts;
    const options = [{ value: "manila", label: "Whole Manila" }];
    if (!Array.isArray(districts) || districts.length === 0) return options;
    return [
      ...options,
      ...districts.map((d) => ({
        value: d.districtKey || d.district,
        label: d.district,
      })),
    ];
  }, [run]);

  const districtForecasts = useMemo(() => {
    const districts = run?.payload?.districts;
    return Array.isArray(districts) ? districts : [];
  }, [run]);

  const cityForecast = useMemo(
    () => buildCityForecast(run?.payload?.districts || []),
    [run],
  );

  const cityChartRows = useMemo(
    () => buildRowsFromForecast(cityForecast),
    [cityForecast],
  );

  const selectedChartScope = useMemo(
    () =>
      selectedChartDistrict === "manila"
        ? cityForecast
        : districtForecasts.find(
            (d) =>
              d.districtKey === selectedChartDistrict ||
              d.district === selectedChartDistrict,
          ) || null,
    [cityForecast, districtForecasts, selectedChartDistrict],
  );

  const selectedHistoryScope = useMemo(
    () =>
      selectedHistoryDistrict === "manila"
        ? cityForecast
        : districtForecasts.find(
            (d) =>
              d.districtKey === selectedHistoryDistrict ||
              d.district === selectedHistoryDistrict,
          ) || null,
    [cityForecast, districtForecasts, selectedHistoryDistrict],
  );

  const selectedErrorScope = useMemo(
    () =>
      selectedErrorDistrict === "manila"
        ? cityForecast
        : districtForecasts.find(
            (d) =>
              d.districtKey === selectedErrorDistrict ||
              d.district === selectedErrorDistrict,
          ) || null,
    [cityForecast, districtForecasts, selectedErrorDistrict],
  );

  const chartRows = useMemo(
    () => buildRowsFromForecast(selectedChartScope),
    [selectedChartScope],
  );

  const historyRows = useMemo(
    () => buildRowsFromForecast(selectedHistoryScope),
    [selectedHistoryScope],
  );

  const errorRows = useMemo(
    () => buildRowsFromForecast(selectedErrorScope),
    [selectedErrorScope],
  );

  const selectedChartLabel = useMemo(
    () =>
      districtOptions.find((option) => option.value === selectedChartDistrict)
        ?.label || "Whole Manila",
    [districtOptions, selectedChartDistrict],
  );

  const selectedHistoryLabel = useMemo(
    () =>
      districtOptions.find((option) => option.value === selectedHistoryDistrict)
        ?.label || "Whole Manila",
    [districtOptions, selectedHistoryDistrict],
  );

  const selectedErrorLabel = useMemo(
    () =>
      districtOptions.find((option) => option.value === selectedErrorDistrict)
        ?.label || "Whole Manila",
    [districtOptions, selectedErrorDistrict],
  );

  const nextForecast = useMemo(() => {
    const fc = Array.isArray(cityForecast?.forecast)
      ? cityForecast.forecast
      : [];
    return normalizeForecastPoint(
      fc.find((r) => r.isPrimaryTarget) || cityForecast?.nextForecast || null,
    );
  }, [cityForecast]);

  const predictionHistoryRows = useMemo(
    () =>
      historyRows.filter((row) => !row.isForecast && hasPredictionResult(row)),
    [historyRows],
  );
  const HISTORY_ROWS_PER_PAGE = 12;
  const historyTotalPages = Math.max(
    1,
    Math.ceil(predictionHistoryRows.length / HISTORY_ROWS_PER_PAGE),
  );
  const pagedPredictionHistoryRows = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_ROWS_PER_PAGE;
    return predictionHistoryRows.slice(start, start + HISTORY_ROWS_PER_PAGE);
  }, [predictionHistoryRows, historyPage]);

  useEffect(() => {
    setHistoryPage(1);
  }, [selectedHistoryDistrict]);

  useEffect(() => {
    if (historyPage > historyTotalPages) {
      setHistoryPage(historyTotalPages);
    }
  }, [historyPage, historyTotalPages]);

  const metrics = useMemo(
    () => calculateMetrics(cityChartRows),
    [cityChartRows],
  );

  const okDistricts = useMemo(() => {
    const districts = run?.payload?.districts;
    if (!Array.isArray(districts)) return [];
    return districts.map((district) => {
      const forecast = Array.isArray(district.forecast)
        ? district.forecast
        : [];
      const targetForecast = normalizeForecastPoint(
        forecast.find((r) => r.isPrimaryTarget) ||
          district.nextForecast ||
          null,
      );
      return { ...district, targetForecast };
    });
  }, [run]);

  const horizonLabel = useMemo(() => {
    if (!run) return null;

    const basisY = run.basisYear;
    const basisM = run.basisMonth;
    const targetY = run.forecastTargetYear;
    const targetM = run.forecastTargetMonth;
    const horizon = run.forecastHorizonMonths;

    if (
      basisY == null ||
      basisM == null ||
      targetY == null ||
      targetM == null
    ) {
      return null;
    }

    return `Official data through ${formatYearMonth(
      basisY,
      basisM,
    )}. Forecast target month: ${formatYearMonth(
      targetY,
      targetM,
    )}. Horizon: ${horizon ?? 1} month${Number(horizon ?? 1) === 1 ? "" : "s"}.`;
  }, [run]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold space-y-6">Predictions</h1>
          <p className="text-gray-600 mt-1 max-w-3xl">
            Monthly case-count forecasts using{" "}
            <span className="font-medium">Facebook Prophet</span> on official
            data. Each district uses one monthly time series based on official
            case counts. The forecast shows the next target month based on the
            latest available official data.
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {isAdmin && (
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              onClick={onRefresh}
              disabled={isGenerating || !token}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                <path d="M21 3v5h-5"></path>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                <path d="M8 16H3v5"></path>
              </svg>
              {isGenerating ? "Refreshing..." : "Refresh forecast"}
            </button>
          )}
        </div>
      </div>

      {!token && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          Sign in to load Prophet forecasts from the server.
        </p>
      )}

      {token && loading && (
        <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
          Loading saved forecast…
        </p>
      )}

      {token && !loading && !run && emptyMsg && (
        <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
          {emptyMsg}
        </p>
      )}

      {run && horizonLabel && (
        <p className="text-sm text-blue-900 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">
          {horizonLabel}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5 text-blue-500"
          >
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
            <polyline points="16 7 22 7 22 13"></polyline>
          </svg>

          <p className="text-sm text-gray-600">
            Manila next month (point estimate)
          </p>

          <p className="text-3xl">
            {nextForecast ? nextForecast.predicted : "—"}
          </p>

          <p className="text-sm text-gray-600 mt-2">
            {nextForecast
              ? `Target: ${formatYearMonth(nextForecast.year, nextForecast.month)}`
              : "No forecast loaded yet"}
          </p>

          {nextForecast?.lower != null && nextForecast?.upper != null && (
            <p className="text-xs text-gray-500 mt-2">
              95% interval approx.: {nextForecast.lower} – {nextForecast.upper}{" "}
              cases
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5 text-green-500"
          >
            <path d="M8 2v4"></path>
            <path d="M16 2v4"></path>
            <rect width="18" height="18" x="3" y="4" rx="2"></rect>
            <path d="M3 10h18"></path>
          </svg>

          <p className="text-sm text-gray-600">Model</p>

          <p className="text-2xl font-semibold">
            {run ? "Prophet (monthly)" : "—"}
          </p>

          <p className="text-sm text-gray-600 mt-2">
            {run?.generatedAt
              ? `Generated ${new Date(run.generatedAt).toLocaleString()}`
              : "—"}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5 text-red-500"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path>
            <path d="M12 9v4"></path>
            <path d="M12 17h.01"></path>
          </svg>

          <p className="text-sm text-gray-600">Backtest error (MAPE / RMSE)</p>

          <p className="text-3xl">
            {metrics?.mape != null ? `${metrics.mape}%` : "—"} /{" "}
            {metrics?.rmse != null ? metrics.rmse : "—"}
          </p>

          <p className="text-sm text-gray-600 mt-2">
            {metrics?.mape != null
              ? "Citywide mean absolute % error on periods with enough history to fit Prophet"
              : "Run a forecast to see metrics"}
          </p>
        </div>
      </div>

      <YearlyActualVsPredictedLineChart
        title={`Actual vs predicted (${selectedChartLabel}, monthly)`}
        data={chartRows}
        controls={
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
            <label className="text-sm text-gray-600" htmlFor="chart-district">
              District
            </label>
            <select
              id="chart-district"
              value={selectedChartDistrict}
              onChange={(e) => setSelectedChartDistrict(e.target.value)}
              disabled={!run || districtOptions.length === 0}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white disabled:opacity-50"
              title="Select district for charts"
            >
              {districtOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <YearlyPredictionErrorBarChart
        title={`Prediction Error by Period (${selectedErrorLabel})`}
        data={errorRows}
        mode="signed"
        controls={
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
            <label className="text-sm text-gray-600" htmlFor="error-district">
              District
            </label>
            <select
              id="error-district"
              value={selectedErrorDistrict}
              onChange={(e) => setSelectedErrorDistrict(e.target.value)}
              disabled={!run || districtOptions.length === 0}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white disabled:opacity-50"
              title="Select district for prediction error chart"
            >
              {districtOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-lg">District next-month outlook</h2>
          <p className="text-sm text-gray-500 max-w-md text-right">
            Each card uses the same Prophet setup for that district’s monthly
            case total. Risk score reflects relative share of the predicted
            next-month total across districts, not a clinical score.
          </p>
        </div>

        {!run?.payload?.districts?.length ? (
          <div className="text-sm text-gray-500">
            Generate a forecast to load per-district results.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {okDistricts.map((d) => (
              <div key={d.district} className={riskCardClass(d.riskLevel)}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-600">District</p>
                    <p className="font-medium">{d.district}</p>
                  </div>

                  {d.riskLevel === "high" && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-5 h-5 text-red-600"
                    >
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path>
                      <path d="M12 9v4"></path>
                      <path d="M12 17h.01"></path>
                    </svg>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Relative risk score</p>

                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-white rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-current opacity-80"
                          style={{ width: `${d.riskScore ?? 0}%` }}
                        />
                      </div>

                      <span className="text-sm">
                        {d.riskScore == null ? "N/A" : `${d.riskScore}%`}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">
                      {nextForecast
                        ? `Predicted Cases (${formatYearMonth(nextForecast.year, nextForecast.month)})`
                        : "Latest data"}
                    </p>
                    <p className="text-2xl">
                      {d.targetForecast?.predicted ?? "No sufficient data"}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Risk band (UI)</p>
                    <p className="capitalize">
                      {d.riskLevel === "insufficient"
                        ? "No sufficient data"
                        : (d.riskLevel ?? "—")}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">
                      MAPE / RMSE (backtest)
                    </p>
                    <p className="text-sm">
                      {d.metrics?.mape != null ? `${d.metrics.mape}%` : "—"} /{" "}
                      {d.metrics?.rmse != null ? d.metrics.rmse : "—"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-lg">
              Monthly Prediction History
            </h2>
            <p className="text-sm text-gray-500">
              {selectedHistoryLabel} — monthly actual vs one-step Prophet
              predictions
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="text-sm text-gray-600" htmlFor="history-district">
              History district
            </label>
            <select
              id="history-district"
              value={selectedHistoryDistrict}
              onChange={(e) => setSelectedHistoryDistrict(e.target.value)}
              disabled={!run || districtOptions.length === 0}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-50"
              title="Select district for prediction history"
            >
              {districtOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left p-3">Period</th>
                <th className="text-left p-3">Predicted</th>
                <th className="text-left p-3">Actual</th>
                <th className="text-left p-3">Abs error %</th>
                <th className="text-left p-3">Interval (95% approx.)</th>
              </tr>
            </thead>

            <tbody>
              {predictionHistoryRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-sm text-gray-500">
                    No prediction-result rows yet. Refresh the forecast to
                    generate backtest history.
                  </td>
                </tr>
              ) : (
                pagedPredictionHistoryRows.map((row, index) => {
                  const actual = Number(row.actual);
                  const predicted = Number(row.predicted);

                  const absPct =
                    actual > 0
                      ? `${(
                          (Math.abs(actual - predicted) / actual) *
                          100
                        ).toFixed(1)}%`
                      : "—";

                  return (
                    <tr
                      key={`${getRowLabel(row)}-${index}`}
                      className="border-b border-gray-100"
                    >
                      <td className="p-3">{getRowLabel(row)}</td>
                      <td className="p-3">{predicted}</td>
                      <td className="p-3">{actual}</td>
                      <td className="p-3">{absPct}</td>
                      <td className="p-3 text-sm text-gray-600">
                        {row.lower != null && row.upper != null
                          ? `${row.lower} – ${row.upper}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {predictionHistoryRows.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span>
              Page {historyPage} of {historyTotalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                disabled={historyPage <= 1}
                className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setHistoryPage((p) => Math.min(historyTotalPages, p + 1))
                }
                disabled={historyPage >= historyTotalPages}
                className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
