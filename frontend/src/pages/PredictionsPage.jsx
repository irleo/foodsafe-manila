import { useEffect, useMemo, useState } from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

import { useAuth } from "../context/AuthContext";
import { notify } from "../utils/toast";
import { fetchLatestPredictions, refreshPredictions } from "../api/predictions";
import { useLatestDatasetId } from "../hooks/useLatestDatasetId";
import DataCoverageNotice from "../components/DataCoverageNotice";
import YearlyActualVsPredictedLineChart from "../components/charts/YearlyActualVsPredictedLineChart";
import YearlyPredictionErrorBarChart from "../components/charts/YearlyPredictionErrorBarChart";
import {
  FORECAST_MODEL_OPTIONS,
  buildPredictionRows,
  getDistrictScope,
  getPredictionScope,
  getPrimaryForecast,
  getWholeManilaScope,
  modelLabel,
} from "../utils/predictionModelView";

const HISTORY_ROWS_PER_PAGE = 12;

function formatMonth(value) {
  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) return "—";
  return new Date(Date.UTC(2026, month - 1, 1)).toLocaleString("en-PH", {
    month: "long",
    timeZone: "UTC",
  });
}

function formatYearMonth(year, month) {
  if (year == null || month == null) return "—";
  return `${formatMonth(month)} ${year}`;
}

function getRowLabel(row) {
  return formatYearMonth(row?.year, row?.month);
}

function displayMetric(value, suffix = "") {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(2)}${suffix}` : "—";
}

function DistrictSelect({ id, value, options, onChange, title }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
      <label className="text-sm text-gray-600" htmlFor={id}>District</label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        title={title}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

function EvaluationTable({ evaluation, selectedMode }) {
  if (!evaluation?.prophet || !evaluation?.seasonalNaive) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
        Insufficient historical backtest data for model comparison. Refresh the forecast to generate the comparison result.
      </div>
    );
  }

  const rows = [
    { label: "MAE", key: "mae", primary: true },
    { label: "RMSE", key: "rmse" },
    { label: "WAPE", key: "wape", suffix: "%" },
    { label: "MAPE", key: "mape", suffix: "%" },
    { label: "Backtest observations", key: "observationCount", integer: true },
  ];
  const prophetWins = evaluation.bestHistoricalModel === "prophet";
  const naiveWins = evaluation.bestHistoricalModel === "seasonal_naive";

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead className="bg-gray-50 text-sm text-gray-600">
            <tr>
              <th className="p-4 text-left font-medium">Metric</th>
              <th className={`p-4 text-right font-medium ${selectedMode === "prophet" ? "bg-blue-50 text-blue-800" : ""}`}>
                Prophet {prophetWins && <span className="ml-1 text-xs">Best MAE</span>}
              </th>
              <th className={`p-4 text-right font-medium ${selectedMode === "seasonal_naive" ? "bg-blue-50 text-blue-800" : ""}`}>
                Seasonal Naïve {naiveWins && <span className="ml-1 text-xs">Best MAE</span>}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={`border-t border-gray-100 ${row.primary ? "bg-blue-50/40 font-semibold" : ""}`}>
                <td className="p-4 text-sm text-gray-700">
                  {row.label}{row.primary && <span className="ml-2 text-xs font-medium text-blue-700">Primary selection metric</span>}
                </td>
                <td className="p-4 text-right text-sm text-gray-900">
                  {row.integer ? evaluation.prophet[row.key] : displayMetric(evaluation.prophet[row.key], row.suffix)}
                </td>
                <td className="p-4 text-right text-sm text-gray-900">
                  {row.integer ? evaluation.seasonalNaive[row.key] : displayMetric(evaluation.seasonalNaive[row.key], row.suffix)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
        {evaluation.sufficient
          ? <>Best historical performance: <strong>{modelLabel(evaluation.bestHistoricalModel)}</strong>, based on lower rolling-origin MAE.</>
          : "Insufficient historical backtest data for model comparison."}
        <span className="ml-2 text-xs text-gray-500">MAPE excludes months where the actual count is zero.</span>
      </div>
    </div>
  );
}

export default function Predictions() {
  const { auth } = useAuth();
  const token = auth?.accessToken;
  const { dataset } = useLatestDatasetId(token);
  const canRefresh = ["admin", "cesu"].includes(auth?.role);

  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [emptyMsg, setEmptyMsg] = useState("");
  const [forecastModel, setForecastModel] = useState("best");
  const [selectedChartDistrict, setSelectedChartDistrict] = useState("manila");
  const [selectedErrorDistrict, setSelectedErrorDistrict] = useState("manila");
  const [selectedHistoryDistrict, setSelectedHistoryDistrict] = useState("manila");
  const [historyPage, setHistoryPage] = useState(1);

  useEffect(() => {
    if (!token) return undefined;
    let isMounted = true;

    (async () => {
      try {
        setLoading(true);
        setEmptyMsg("");
        const response = await fetchLatestPredictions(token);
        if (!isMounted) return;
        if (response?.hasPrediction === false) {
          setRun(null);
          setEmptyMsg(response.message || "No saved monthly prediction run found.");
        } else {
          setRun(response);
        }
      } catch (error) {
        if (!isMounted) return;
        setRun(null);
        setEmptyMsg(error?.message || "Failed to load saved forecast");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const onRefresh = () => {
    const refresh = async () => {
      if (!token) throw new Error("Sign in to refresh predictions.");
      if (!canRefresh) throw new Error("Admin or CESU access is required to refresh.");
      setIsGenerating(true);
      try {
        await refreshPredictions(token);
        const response = await fetchLatestPredictions(token);
        if (response?.hasPrediction === false) {
          throw new Error(response.message || "No prediction run was created.");
        }
        setRun(response);
        setForecastModel("best");
        setSelectedChartDistrict("manila");
        setSelectedErrorDistrict("manila");
        setSelectedHistoryDistrict("manila");
        setHistoryPage(1);
        setEmptyMsg("");
        return response;
      } finally {
        setIsGenerating(false);
      }
    };

    notify.promise(refresh(), {
      loading: "Refreshing both forecasting models…",
      success: "Forecast comparison refreshed",
      error: (error) => error?.message || "Failed to refresh forecast",
    });
  };

  const payload = useMemo(() => run?.payload || {}, [run]);
  const comparisonAvailable = Number(payload.schemaVersion) >= 2;
  const districts = useMemo(
    () => (Array.isArray(payload.districts) ? payload.districts : []),
    [payload.districts],
  );
  const districtOptions = useMemo(() => [
    { value: "manila", label: "Whole Manila" },
    ...districts.map((district) => ({
      value: district.districtKey || district.district,
      label: district.district,
    })),
  ], [districts]);

  const wholeManilaScope = useMemo(
    () => getWholeManilaScope(payload, forecastModel),
    [forecastModel, payload],
  );
  const chartScope = useMemo(
    () => getPredictionScope(payload, selectedChartDistrict, forecastModel),
    [forecastModel, payload, selectedChartDistrict],
  );
  const errorScope = useMemo(
    () => getPredictionScope(payload, selectedErrorDistrict, forecastModel),
    [forecastModel, payload, selectedErrorDistrict],
  );
  const historyScope = useMemo(
    () => getPredictionScope(payload, selectedHistoryDistrict, forecastModel),
    [forecastModel, payload, selectedHistoryDistrict],
  );

  const chartRows = useMemo(() => buildPredictionRows(chartScope), [chartScope]);
  const errorRows = useMemo(() => buildPredictionRows(errorScope), [errorScope]);
  const historyRows = useMemo(() => buildPredictionRows(historyScope), [historyScope]);
  const predictionHistoryRows = useMemo(
    () => historyRows.filter((row) => !row.isForecast && Number.isFinite(row.actual) && Number.isFinite(row.predicted)),
    [historyRows],
  );
  const historyTotalPages = Math.max(1, Math.ceil(predictionHistoryRows.length / HISTORY_ROWS_PER_PAGE));
  const safeHistoryPage = Math.min(historyPage, historyTotalPages);
  const pagedHistoryRows = predictionHistoryRows.slice(
    (safeHistoryPage - 1) * HISTORY_ROWS_PER_PAGE,
    safeHistoryPage * HISTORY_ROWS_PER_PAGE,
  );

  const nextForecast = getPrimaryForecast(wholeManilaScope);
  const selectedModelName = modelLabel(wholeManilaScope?.resolvedModel);
  const evaluation = payload.modelEvaluation || null;
  const modelCoverage = payload.modelCoverage || null;
  const activeCoverage = wholeManilaScope?.coverage || payload.coverage || {};
  const chartLabel = districtOptions.find((option) => option.value === selectedChartDistrict)?.label || "Whole Manila";
  const errorLabel = districtOptions.find((option) => option.value === selectedErrorDistrict)?.label || "Whole Manila";
  const historyLabel = districtOptions.find((option) => option.value === selectedHistoryDistrict)?.label || "Whole Manila";
  const horizonMonths = Number(run?.forecastHorizonMonths || 1);

  const districtOutlooks = useMemo(() => districts.map((district) => {
    const scope = getDistrictScope(district, forecastModel);
    return {
      district: district.district,
      message: scope?.message || district.message,
      model: scope?.resolvedModel,
      comparison: district.modelComparison,
      forecast: getPrimaryForecast(scope),
    };
  }), [districts, forecastModel]);
  const hasInsufficientDistrictComparison = districtOutlooks.some(
    (item) => forecastModel === "best" && !item.comparison?.sufficient,
  );

  const changeForecastModel = (nextModel) => {
    setForecastModel(nextModel);
    setHistoryPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-bold">Predictions</h1>
          <p className="mt-1 max-w-4xl text-gray-600">
            Monthly district forecasts compare Prophet with a Seasonal Naïve baseline using identical rolling-origin historical targets. Users may inspect either method or use the district model with the lower historical MAE. Forecast inputs contain validated/confirmed cases only; reported, suspected, not-validated, ruled-out, and duplicate-suppressed reports are excluded.
          </p>
        </div>
        {canRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isGenerating || !token}
            className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <span aria-hidden="true">↻</span>
            {isGenerating ? "Refreshing…" : "Refresh Forecast"}
          </button>
        )}
      </div>

      <DataCoverageNotice
        dataset={dataset}
        fallbackText="Forecasts use only validated/confirmed records available in this period. No complete CESU history before 2022 is implied."
      />

      {!token && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">Sign in to load saved forecasts.</p>}
      {token && loading && <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600">Loading saved forecast comparison…</p>}
      {token && !loading && !run && emptyMsg && <p className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700">{emptyMsg}</p>}

      {run && activeCoverage.totalDistricts > 0 && !activeCoverage.completeCityForecast && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Whole-Manila output is unavailable for this model because only {activeCoverage.successfulDistricts} of {activeCoverage.totalDistricts} districts produced a valid target forecast. District results remain visible below.
        </p>
      )}
      {run && comparisonAvailable && modelCoverage?.prophet?.successfulDistricts < modelCoverage?.prophet?.totalDistricts && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Prophet produced a target forecast for {modelCoverage.prophet.successfulDistricts} of {modelCoverage.prophet.totalDistricts} districts. Seasonal Naïve and operational fallback results remain available, but the affected districts cannot be compared fairly until Prophet succeeds.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-600">Predicted validated/confirmed cases — not actual cases</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{nextForecast?.predicted ?? "—"}</p>
          <p className="mt-2 text-sm text-gray-600">
            {nextForecast ? "Whole-Manila analytical estimate" : "No complete Whole-Manila forecast available"}
          </p>
          {forecastModel === "prophet" && nextForecast?.lower != null && nextForecast?.upper != null && (
            <p className="mt-2 text-xs text-gray-500">95% prediction interval: {nextForecast.lower}–{nextForecast.upper} cases</p>
          )}
          {nextForecast && wholeManilaScope?.resolvedModel === "mixed" && (
            <p className="mt-2 text-xs text-blue-700">Sum of each district’s selected best-model forecast.</p>
          )}
          {run && (
            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-gray-100 pt-4">
              <div className="rounded-lg bg-blue-50 px-3 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-blue-600">Target month</p>
                <p className="mt-1 text-sm font-semibold text-blue-900">{formatYearMonth(run.forecastTargetYear, run.forecastTargetMonth)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Horizon</p>
                <p className="mt-1 text-sm font-semibold text-gray-800">{horizonMonths} month{horizonMonths === 1 ? "" : "s"}</p>
              </div>
              <div className="col-span-2 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-blue-800">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                Forecast input: validated/confirmed cases only
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-blue-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-1.5">
            <label htmlFor="forecast-model" className="text-sm font-medium text-gray-600">Selected Model</label>
            <div className="group relative flex">
              <button
                type="button"
                aria-label="About forecast model selection"
                aria-describedby="forecast-model-help"
                className="rounded-full text-gray-400 transition-colors hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
              >
                <InformationCircleIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              <div
                id="forecast-model-help"
                role="tooltip"
                className="pointer-events-none invisible absolute right-0 top-6 z-20 w-72 rounded-lg bg-gray-900 px-3 py-2 text-xs font-normal leading-5 text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
              >
                Best Model uses the lower rolling-origin MAE for each district. MAE ties select Seasonal Naïve. Changing this option updates the entire prediction page.
              </div>
            </div>
          </div>

          <select
            id="forecast-model"
            value={forecastModel}
            onChange={(event) => changeForecastModel(event.target.value)}
            className="mt-2 w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            {FORECAST_MODEL_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.value === "seasonal_naive" && !comparisonAvailable}
              >
                {option.label}
              </option>
            ))}
          </select>

          <p className="mt-3 text-xs text-gray-500">Currently displaying</p>
          <p className="mt-0.5 text-xl font-semibold text-gray-900">
            {forecastModel === "prophet" ? "Prophet (monthly)" : selectedModelName}
          </p>
          {forecastModel === "best" && (
            <p className="mt-2 text-sm text-blue-700">
              {hasInsufficientDistrictComparison
                ? "Selection basis: lower district MAE where sufficient; available operational fallback otherwise"
                : "Selection basis: lower district rolling-backtest MAE"}
            </p>
          )}
          {!comparisonAvailable && (
            <p className="mt-2 text-sm text-amber-700">Refresh Forecast to generate the model comparison.</p>
          )}
          <p className="mt-2 text-sm text-gray-600">{run?.generatedAt ? `Generated ${new Date(run.generatedAt).toLocaleString("en-PH")}` : "—"}</p>
        </div>
      </div>

      <YearlyActualVsPredictedLineChart
        title={`Historical Confirmed vs Predicted — ${modelLabel(chartScope?.resolvedModel)} (${chartLabel})`}
        data={chartRows}
        controls={<DistrictSelect id="chart-district" value={selectedChartDistrict} options={districtOptions} onChange={setSelectedChartDistrict} title="Select district for the historical chart" />}
      />

      <div>
        <h2 className="text-lg font-semibold">Model Evaluation</h2>
        <p className="mt-1 text-sm text-gray-500">Both models use the same district-month targets. MAE is the primary selection metric; RMSE and WAPE provide supporting evidence.</p>
      </div>
      <EvaluationTable evaluation={evaluation} selectedMode={forecastModel} />

      <YearlyPredictionErrorBarChart
        title={`Prediction Error by Period — ${modelLabel(errorScope?.resolvedModel)} (${errorLabel})`}
        data={errorRows}
        mode="signed"
        controls={<DistrictSelect id="error-district" value={selectedErrorDistrict} options={districtOptions} onChange={setSelectedErrorDistrict} title="Select district for prediction errors" />}
      />

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-lg font-semibold">District Next-Month Outlook</h2>
            <p className="mt-1 text-sm text-gray-500">Analytical estimates intended to support short-term surveillance.</p>
          </div>
          <p className="max-w-md text-sm text-gray-500 sm:text-right">These values are not observed cases, guaranteed counts, predicted outbreaks, or official outbreak declarations.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {districtOutlooks.map((item) => (
            <article key={item.district} className="rounded-xl border border-gray-200 bg-gray-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-gray-900">{item.district}</h3>
                {forecastModel === "best" && item.comparison?.sufficient && (
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">Best historical performance</span>
                )}
              </div>
              <p className="mt-4 text-xs text-gray-500">Predicted validated/confirmed cases — not actual</p>
              <p className="mt-1 text-2xl font-semibold">{item.forecast?.predicted ?? "—"}</p>
              <p className="mt-2 text-sm text-gray-600">Model: <strong>{modelLabel(item.model)}</strong></p>
              {forecastModel === "best" && !item.comparison?.sufficient && (
                <p className="mt-2 text-xs text-amber-700">Insufficient historical backtest data for model comparison; the available operational fallback is shown.</p>
              )}
              {!item.forecast && <p className="mt-2 text-xs text-amber-700">{item.message || "No sufficient data"}</p>}
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold">Monthly Prediction History</h2>
            <p className="mt-1 text-sm text-gray-500">{historyLabel} — one-step {modelLabel(historyScope?.resolvedModel)} predictions</p>
          </div>
          <DistrictSelect
            id="history-district"
            value={selectedHistoryDistrict}
            options={districtOptions}
            onChange={(value) => {
              setSelectedHistoryDistrict(value);
              setHistoryPage(1);
            }}
            title="Select district for prediction history"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-200 text-sm text-gray-600">
                <th className="p-3 text-left">Period</th>
                <th className="p-3 text-right">Predicted</th>
                <th className="p-3 text-right">Historical Confirmed</th>
                <th className="p-3 text-right">Absolute Error</th>
                <th className="p-3 text-right">Error %</th>
                <th className="p-3 text-left">Model</th>
                <th className="p-3 text-left">95% Prediction Interval</th>
              </tr>
            </thead>
            <tbody>
              {!pagedHistoryRows.length ? (
                <tr><td colSpan={7} className="p-4 text-sm text-gray-500">No comparable backtest observations are available.</td></tr>
              ) : pagedHistoryRows.map((row) => {
                const absoluteError = Math.abs(row.actual - row.predicted);
                const errorPercent = row.actual > 0 ? `${((absoluteError / row.actual) * 100).toFixed(1)}%` : "—";
                return (
                  <tr key={`${row.year}-${row.month}`} className="border-b border-gray-100 text-sm">
                    <td className="p-3">{getRowLabel(row)}</td>
                    <td className="p-3 text-right">{row.predicted}</td>
                    <td className="p-3 text-right">{row.actual}</td>
                    <td className="p-3 text-right">{absoluteError}</td>
                    <td className="p-3 text-right">{errorPercent}</td>
                    <td className="p-3">{modelLabel(row.model)}</td>
                    <td className="p-3 text-gray-600">{row.lower != null && row.upper != null ? `${row.lower}–${row.upper}` : "Not applicable"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {predictionHistoryRows.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span>Page {safeHistoryPage} of {historyTotalPages}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setHistoryPage((page) => Math.max(1, page - 1))} disabled={safeHistoryPage <= 1} className="rounded-lg border border-gray-300 bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
              <button type="button" onClick={() => setHistoryPage((page) => Math.min(historyTotalPages, page + 1))} disabled={safeHistoryPage >= historyTotalPages} className="rounded-lg border border-gray-300 bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
