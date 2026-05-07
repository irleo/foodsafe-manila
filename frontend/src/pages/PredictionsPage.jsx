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
  return "border-2 rounded-xl p-6 bg-green-100 text-green-700 border-green-300";
}

export default function Predictions() {
  const { auth } = useAuth();
  const token = auth?.accessToken;
  const role = auth?.role;
  const isAdmin = role === "admin";

  const [isGenerating, setIsGenerating] = useState(false);
  const [run, setRun] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState("all");
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
        const data = await refreshPredictions(token);
        setRun(data);
        setSelectedDistrict("all");
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

  const activeForecast = useMemo(() => {
    if (!run) return null;
    if (selectedDistrict === "all") return run.total;
    return (
      run.districts?.find(
        (d) => d.ok && d.district === selectedDistrict,
      ) || null
    );
  }, [run, selectedDistrict]);

  const chartRows = activeForecast?.compareRows || [];

  const metrics = activeForecast?.metrics;
  const nextForecast = activeForecast?.nextForecast;

  const districtOptions = useMemo(() => {
    const base = [{ value: "all", label: "All districts (city total)" }];
    if (!run?.districts?.length) return base;
    const ok = run.districts.filter((d) => d.ok).map((d) => d.district);
    return [
      ...base,
      ...ok.map((d) => ({ value: d, label: d })),
    ];
  }, [run]);

  const okDistricts = useMemo(
    () => (run?.districts || []).filter((d) => d.ok),
    [run],
  );

  const horizonLabel = useMemo(() => {
    if (!run?.forecastStartYear || !run?.forecastEndYear) return null;
    const same = run.forecastStartYear === run.forecastEndYear;
    const yPart = same
      ? String(run.forecastStartYear)
      : `${run.forecastStartYear}–${run.forecastEndYear}`;
    const basisY = run.basisYear;
    const basisM = run.basisMonth;
    if (basisY == null) return `Predicted year(s): ${yPart}.`;
    const basisPart =
      basisM != null
        ? `Official data through ${basisY}-${String(basisM).padStart(2, "0")}`
        : `Official yearly data through ${basisY}`;
    return `Predicting ${yPart} from ${basisPart}.`;
  }, [run]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold space-y-6">Predictions</h1>
          <p className="text-gray-600 mt-1 max-w-3xl">
            Yearly case-count forecasts using{" "}
            <span className="font-medium">Facebook Prophet</span> on official
            data. Totals and each district use the same method: one series per
            scope (sum of cases across diseases), annual granularity, expanding
            backtest for the chart and full-history fit for the next-year
            forecast. Confidence intervals are Prophet’s default prediction
            bands.
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            disabled={!run}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-50"
            title="Select scope for charts and metrics"
          >
            {districtOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {isAdmin && (
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
              Refresh forecast
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
          <p className="text-sm text-gray-600">Next year (point estimate)</p>
          <p className="text-3xl">
            {nextForecast ? nextForecast.predicted : "—"}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            {nextForecast
              ? `Calendar year ${nextForecast.targetYear} (model trained on years ≤ ${nextForecast.basisYear})`
              : "No forecast loaded yet"}
          </p>
          {nextForecast && (
            <p className="text-xs text-gray-500 mt-2">
              95% interval (approx.): {nextForecast.lower} – {nextForecast.upper}{" "}
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
            {run ? "Prophet (yearly)" : "—"}
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
              ? "Mean absolute % error on years with enough history to fit Prophet"
              : "Run a forecast to see metrics"}
          </p>
        </div>
      </div>

      <YearlyActualVsPredictedLineChart
        title={
          selectedDistrict === "all"
            ? "Actual vs predicted (city total, yearly)"
            : `Actual vs predicted (${selectedDistrict}, yearly)`
        }
        data={chartRows}
      />
      <YearlyPredictionErrorBarChart
        data={chartRows}
        mode="signed"
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-lg">District next-year outlook</h2>
          <p className="text-sm text-gray-500 max-w-md text-right">
            Each card uses the same Prophet setup as above, for that district’s
            yearly case total. Risk score reflects relative share of the
            predicted next-year total across districts (not a clinical score).
          </p>
        </div>
        {!run?.districts?.length ? (
          <div className="text-sm text-gray-500">
            Generate a forecast to load per-district results.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {okDistricts.map((d) => (
              <div
                key={d.district}
                className={riskCardClass(d.riskLevel)}
              >
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
                      <span className="text-sm">{d.riskScore ?? 0}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Predicted cases (next year)</p>
                    <p className="text-2xl">{d.nextForecast?.predicted ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Risk band (UI)</p>
                    <p className="capitalize">{d.riskLevel ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">MAPE / RMSE (backtest)</p>
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-lg">Prediction History</h2>
          <p className="text-sm text-gray-500">
            {selectedDistrict === "all"
              ? "City total — yearly actual vs one-step Prophet predictions"
              : `${selectedDistrict} — yearly actual vs one-step Prophet predictions`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left p-3">Year</th>
                <th className="text-left p-3">Predicted</th>
                <th className="text-left p-3">Actual</th>
                <th className="text-left p-3">Abs error %</th>
                <th className="text-left p-3">Interval (95% approx.)</th>
              </tr>
            </thead>
            <tbody>
              {chartRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-sm text-gray-500">
                    No rows yet. Generate a forecast.
                  </td>
                </tr>
              ) : (
                chartRows.map((row) => {
                  const actual = Number(row.actual ?? 0);
                  const predicted = Number(row.predicted ?? 0);
                  const absPct =
                    actual > 0
                      ? `${((Math.abs(actual - predicted) / actual) * 100).toFixed(1)}%`
                      : "—";
                  return (
                    <tr key={row.year} className="border-b border-gray-100">
                      <td className="p-3">{row.year}</td>
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
      </div>
    </div>
  );
}
