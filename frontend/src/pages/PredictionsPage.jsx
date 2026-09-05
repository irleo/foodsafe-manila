import { useEffect, useMemo, useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

import { useAuth } from "../context/AuthContext";
import { notify } from "../utils/toast";
import { formatStatusLabel } from "../utils/formatStatusLabel";
import { getErrorMessage } from "../utils/errors";
import { fetchLatestPredictions, refreshPredictions } from "../api/predictions";
import { useLatestDatasetId } from "../hooks/useLatestDatasetId";
import DataCoverageNotice from "../components/DataCoverageNotice";
import YearlyActualVsPredictedLineChart from "../components/charts/YearlyActualVsPredictedLineChart";
import YearlyPredictionErrorBarChart from "../components/charts/YearlyPredictionErrorBarChart";
import {
  buildPredictionRows,
  getDistrictScope,
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

function EvaluationTable({ evaluation }) {
  if (!evaluation?.prophet || !evaluation?.seasonalNaive) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
        Insufficient historical backtest data for model comparison. Refresh the
        forecast to generate the comparison result.
      </div>
    );
  }

  const rows = [
    {
      label: "Average difference from actual counts",
      key: "mae",
      primary: true,
    },
    { label: "Difference when larger errors matter more", key: "rmse" },
    { label: "Overall error rate", key: "wape", suffix: "%" },
    {
      label: "Historical months checked",
      key: "observationCount",
      integer: true,
    },
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
              <th
                className="bg-blue-50 p-4 text-right font-medium text-blue-800"
              >
                Operational: Trend-based method (Prophet){" "}
                {prophetWins && (
                  <span className="ml-1 text-xs">Smaller average error</span>
                )}
              </th>
              <th className="p-4 text-right font-medium">
                Benchmark: Same month last year{" "}
                {naiveWins && (
                  <span className="ml-1 text-xs">Smaller average error</span>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className={`border-t border-gray-100 ${row.primary ? "bg-blue-50/40 font-semibold" : ""}`}
              >
                <td className="p-4 text-sm text-gray-700">
                  {row.label}
                  {row.primary && (
                    <span className="ml-2 text-xs font-medium text-blue-700">
                      Benchmark comparison only
                    </span>
                  )}
                </td>
                <td className="p-4 text-right text-sm text-gray-900">
                  {row.integer
                    ? evaluation.prophet[row.key]
                    : displayMetric(evaluation.prophet[row.key], row.suffix)}
                </td>
                <td className="p-4 text-right text-sm text-gray-900">
                  {row.integer
                    ? evaluation.seasonalNaive[row.key]
                    : displayMetric(
                        evaluation.seasonalNaive[row.key],
                        row.suffix,
                      )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
        {evaluation.sufficient ? (
          <>
            Best historical performance:{" "}
            <strong>{modelLabel(evaluation.bestHistoricalModel)}</strong>, based
            on the smaller average error.
          </>
        ) : (
          "There is not enough shared history to compare both methods fairly."
        )}
        <span className="ml-2 text-xs text-gray-500">
          Prophet remains the operational method regardless of the benchmark result. Error rates omit months where the actual count is zero.
        </span>
      </div>
    </div>
  );
}

function getTrustSummary(evaluation) {
  const observationCount = Number(evaluation?.prophet?.observationCount || 0);
  const checkedMonths = observationCount
    ? ` across ${observationCount} matched district-month checks`
    : "";

  if (!evaluation?.sufficient) {
    return "Limited shared history; treat the forecast as decision support, not an observed result.";
  }

  if (evaluation.bestHistoricalModel === "prophet") {
    return `Prophet had the smaller historical average error${checkedMonths}.`;
  }

  return `The benchmark had the smaller historical average error${checkedMonths}; Prophet remains the operational model.`;
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
  const forecastModel = "prophet";
  const [selectedDisease, setSelectedDisease] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
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
          setEmptyMsg(
            response.message ||
              "No saved monthly district prediction run found.",
          );
        } else {
          setRun(response);
        }
      } catch (error) {
        if (!isMounted) return;
        setRun(null);
        setEmptyMsg(getErrorMessage(error, "Prediction data is currently unavailable."));
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
      if (!canRefresh)
        throw new Error(
          "System Administrator or Data Manager access is required to refresh.",
        );
      setIsGenerating(true);
      try {
        const refreshResult = await refreshPredictions(token, {
          forecastHorizonMonths: 1,
        });
        const response = await fetchLatestPredictions(token);
        if (response?.hasPrediction === false) {
          throw new Error(response.message || "No prediction run was created.");
        }
        setRun(response);
        setSelectedDistrict("");
        setHistoryPage(1);
        setEmptyMsg("");
        return {
          ...response,
          alreadyUpToDate: refreshResult?.alreadyUpToDate === true,
        };
      } finally {
        setIsGenerating(false);
      }
    };

    notify.promise(refresh(), {
      loading: "Checking the latest dataset and saved forecasts…",
      success: (result) =>
        result?.alreadyUpToDate
          ? "Saved forecasts are already up to date"
          : "Monthly forecasts refreshed",
      error: (error) => getErrorMessage(error, "Prediction data is currently unavailable."),
    });
  };

  const globalPayload = useMemo(() => run?.payload || {}, [run]);
  const diseaseOptions = useMemo(
    () =>
      Array.isArray(globalPayload.diseases)
        ? globalPayload.diseases.map((item) => item.disease).filter(Boolean)
        : [],
    [globalPayload.diseases],
  );
  useEffect(() => {
    if (!diseaseOptions.length) return;
    if (!diseaseOptions.includes(selectedDisease))
      setSelectedDisease(diseaseOptions[0]);
  }, [diseaseOptions, selectedDisease]);
  const payload = useMemo(
    () =>
      globalPayload.diseases?.find(
        (item) => item.disease === selectedDisease,
      ) ||
      globalPayload.diseases?.[0] ||
      globalPayload,
    [globalPayload, selectedDisease],
  );
  const comparisonAvailable = Number(globalPayload.schemaVersion) >= 2;
  const districts = useMemo(
    () => (Array.isArray(payload.districts) ? payload.districts : []),
    [payload.districts],
  );
  const districtOutlooks = useMemo(
    () =>
      districts.map((district) => {
        const scope = getDistrictScope(district, forecastModel);
        return {
          key: district.districtKey || district.district,
          district: district.district,
          message: scope?.message || district.message,
          forecast: getPrimaryForecast(scope),
          scope,
        };
      }),
    [districts, forecastModel],
  );
  useEffect(() => {
    if (
      selectedDistrict &&
      !districtOutlooks.some((item) => item.key === selectedDistrict)
    ) {
      setSelectedDistrict("");
    }
  }, [districtOutlooks, selectedDistrict]);

  const selectedDistrictOutlook = useMemo(
    () => districtOutlooks.find((item) => item.key === selectedDistrict) || null,
    [districtOutlooks, selectedDistrict],
  );
  const wholeManilaScope = useMemo(
    () => getWholeManilaScope(payload, forecastModel),
    [payload, forecastModel],
  );
  const selectedScope = selectedDistrict
    ? selectedDistrictOutlook?.scope || null
    : wholeManilaScope;
  const selectedForecast = getPrimaryForecast(selectedScope);
  const selectedLabel = selectedDistrictOutlook?.district || "Whole Manila";
  const selectedRows = useMemo(
    () => buildPredictionRows(selectedScope),
    [selectedScope],
  );
  const predictionHistoryRows = useMemo(
    () =>
      selectedRows.filter(
        (row) =>
          !row.isForecast &&
          Number.isFinite(row.actual) &&
          Number.isFinite(row.predicted),
      ),
    [selectedRows],
  );
  const historyTotalPages = Math.max(
    1,
    Math.ceil(predictionHistoryRows.length / HISTORY_ROWS_PER_PAGE),
  );
  const safeHistoryPage = Math.min(historyPage, historyTotalPages);
  const pagedHistoryRows = predictionHistoryRows.slice(
    (safeHistoryPage - 1) * HISTORY_ROWS_PER_PAGE,
    safeHistoryPage * HISTORY_ROWS_PER_PAGE,
  );

  const evaluation = payload.modelEvaluation || null;
  const modelCoverage = payload.modelCoverage || null;
  const horizonMonths = Number(run?.forecastHorizonMonths || 1);
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-bold">Predictions</h1>
          <p className="mt-1 max-w-4xl text-gray-600">
            New official datasets automatically generate monthly forecasts for
            every supported disease and all six districts. Saved results are
            reused until another dataset is uploaded.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          {canRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isGenerating || !token}
              className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <span aria-hidden="true">↻</span>
              {isGenerating
                ? "Refreshing forecast..."
                : "Refresh Forecast"}
            </button>
          )}
        </div>
      </div>

      <DataCoverageNotice
        dataset={dataset}
        fallbackText="Weekly source records are aggregated into calendar months. Covered months without a confirmed-case record are interpreted as zero; months outside verified coverage remain missing."
      />

      {!token && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Sign in to load saved forecasts.
        </p>
      )}
      {token && loading && (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600">
          Loading saved forecast comparison…
        </p>
      )}
      {token && !loading && !run && emptyMsg && (
        <p className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700">
          {emptyMsg}
        </p>
      )}

      {run &&
        comparisonAvailable &&
        modelCoverage?.prophet?.successfulDistricts <
          modelCoverage?.prophet?.totalDistricts && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            The trend-based method produced a forecast for{" "}
            {modelCoverage.prophet.successfulDistricts} of{" "}
            {modelCoverage.prophet.totalDistricts} districts. Missing districts
            remain unavailable because no fallback method is substituted.
          </p>
        )}

      {run && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
                District forecast
              </p>
              <h2 className="mt-1 text-xl font-semibold text-gray-900">
                Choose a district to follow its forecast story
              </h2>
            </div>
            {diseaseOptions.length > 0 && (
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
                Disease
                <select
                  id="prediction-disease"
                  value={selectedDisease}
                  onChange={(event) => {
                    setSelectedDisease(event.target.value);
                    setHistoryPage(1);
                  }}
                  className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
                >
                  {diseaseOptions.map((disease) => (
                    <option key={disease} value={disease}>
                      {disease}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label="Forecast district">
            {districtOutlooks.map((item) => {
              const isSelected = item.key === selectedDistrict;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedDistrict(isSelected ? "" : item.key);
                    setHistoryPage(1);
                  }}
                  className={`min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                    isSelected
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                  title={item.forecast ? `Show ${item.district}` : item.message || "Forecast unavailable"}
                >
                  {item.district}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            {selectedDistrict
              ? "Select the active district again to return to Whole Manila."
              : "No district selected — showing Whole Manila."}
          </p>

          {selectedForecast ? (
            <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(240px,0.32fr)_minmax(0,0.68fr)]">
              <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-500 p-6 text-white">
                <p className="text-sm font-medium text-blue-100">
                  {selectedLabel} · {formatYearMonth(run.forecastTargetYear, run.forecastTargetMonth)}
                </p>
                <p className="mt-5 text-6xl font-semibold tracking-tight">
                  {selectedForecast.predicted}
                </p>
                <p className="mt-1 text-sm text-blue-100">
                  predicted eligible cases — not actual cases
                </p>
                {selectedForecast.expectedStatus && (
                  <p className="mt-5 inline-flex rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">
                    {formatStatusLabel(selectedForecast.expectedStatus)}
                  </p>
                )}
                <div className="mt-6 border-t border-white/20 pt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-100">
                    Prophet 95% prediction interval
                  </p>
                  {selectedForecast.lower != null && selectedForecast.upper != null ? (
                    <p className="mt-1 text-2xl font-semibold">
                      {selectedForecast.lower}–{selectedForecast.upper} cases
                    </p>
                  ) : (
                    <p className="mt-1 text-sm font-medium">Prediction interval not calculated</p>
                  )}
                  <p className="mt-4 text-xs leading-5 text-blue-100">
                    {horizonMonths}-month horizon · Generated {run.generatedAt ? new Date(run.generatedAt).toLocaleString("en-PH") : "—"}
                  </p>
                </div>
              </div>

              <YearlyActualVsPredictedLineChart
                title={`${selectedLabel} forecast trajectory`}
                data={selectedRows}
                height={360}
                description={selectedDistrict
                  ? "Historical confirmed and Prophet backtest values lead into next month. The shaded fan appears only between the latest observation and the forecast, widening to the district's 95% prediction interval."
                  : "Historical Whole-Manila totals and bottom-up Prophet predictions lead into next month. A shaded fan appears only when the aggregate forecast has a genuinely calculated 95% interval."}
              />
            </div>
          ) : (
            <p className="mt-6 rounded-xl bg-gray-50 p-5 text-sm text-gray-600">
              No district forecast is available for this disease.
            </p>
          )}
        </section>
      )}

      {run && (
        <details className="group rounded-xl border border-gray-200 bg-white shadow-sm">
          <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
            <span className="font-semibold text-gray-900">Model performance</span>
            <span className="min-w-0 flex-1 text-sm text-gray-600 sm:text-right">
              {getTrustSummary(evaluation)}
            </span>
            <ChevronDownIcon className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-gray-100 p-5">
            <p className="mb-4 text-sm text-gray-600">
              Prophet is checked against the same-month-last-year benchmark on shared historical months. This comparison monitors trust; it never switches the operational model.
            </p>
            <EvaluationTable evaluation={evaluation} />
          </div>
        </details>
      )}

      {run && selectedScope && (
        <>
          <YearlyPredictionErrorBarChart
            title={`Prediction Error by Period — ${modelLabel(selectedScope?.resolvedModel)} (${selectedLabel})`}
            data={selectedRows}
            mode="signed"
            description="Each bar is a rolling one-step Prophet error for the selected district. Seasonal Naive benchmark errors are excluded from this operational chart."
          />

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold">
              Monthly Prediction History
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {selectedLabel} — one-step{" "}
              {modelLabel(selectedScope?.resolvedModel)} predictions
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-200 text-sm text-gray-600">
                <th className="p-3 text-left">Period</th>
                <th className="p-3 text-right">Predicted</th>
                <th className="p-3 text-right">Historical Confirmed Cases</th>
                <th className="p-3 text-right">Absolute Error</th>
                <th className="p-3 text-right">Error %</th>
                <th className="p-3 text-center">95% Prediction Interval</th>
              </tr>
            </thead>
            <tbody>
              {!pagedHistoryRows.length ? (
                <tr>
                    <td colSpan={6} className="p-4 text-sm text-gray-500">
                    No comparable backtest observations are available.
                  </td>
                </tr>
              ) : (
                pagedHistoryRows.map((row) => {
                  const absoluteError = Math.abs(row.actual - row.predicted);
                  const errorPercent =
                    row.actual > 0
                      ? `${((absoluteError / row.actual) * 100).toFixed(1)}%`
                      : "—";
                  return (
                    <tr
                      key={`${row.year}-${row.month}`}
                      className="border-b border-gray-100 text-sm"
                    >
                      <td className="p-3">{getRowLabel(row)}</td>
                      <td className="p-3 text-right">{row.predicted}</td>
                      <td className="p-3 text-right">{row.actual}</td>
                      <td className="p-3 text-right">{absoluteError}</td>
                      <td className="p-3 text-right">{errorPercent}</td>
                      <td className="p-3 text-gray-600 text-center">
                        {row.lower != null && row.upper != null
                          ? `${row.lower}–${row.upper}`
                          : "Not calculated"}
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
              Page {safeHistoryPage} of {historyTotalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                disabled={safeHistoryPage <= 1}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setHistoryPage((page) =>
                    Math.min(historyTotalPages, page + 1),
                  )
                }
                disabled={safeHistoryPage >= historyTotalPages}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
          </section>
        </>
      )}
    </div>
  );
}
