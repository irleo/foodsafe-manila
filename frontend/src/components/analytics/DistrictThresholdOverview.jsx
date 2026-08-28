import { useEffect, useState } from "react";
import { fetchCurrentThreshold } from "../../api/thresholds";
import { SURVEILLANCE_DISEASES } from "../../constants/surveillanceMethodology.js";
import { formatStatusLabel } from "../../utils/formatStatusLabel";

const MANILA_DISTRICTS = Array.from(
  { length: 6 },
  (_, index) => `District ${index + 1}`,
);

function formatThresholdPeriod(result) {
  if (!result?.targetYear) return "Not available";
  if (!result.targetMonth) return String(result.targetYear);
  return new Date(Date.UTC(result.targetYear, result.targetMonth - 1)).toLocaleString(
    "en-PH",
    { month: "short", year: "numeric", timeZone: "UTC" },
  );
}

function thresholdStatusClass(outcome) {
  if (outcome === "epidemic_threshold_exceeded") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (outcome === "alert_threshold_exceeded") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (outcome === "within_expected_level") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  return "border-gray-200 bg-gray-100 text-gray-600";
}

export default function DistrictThresholdOverview({ token, datasetId }) {
  const [disease, setDisease] = useState(SURVEILLANCE_DISEASES[0]);
  const [thresholdResults, setThresholdResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token || !datasetId) {
      setThresholdResults({});
      return undefined;
    }

    let isMounted = true;
    setLoading(true);
    setErrorMessage("");

    Promise.allSettled(
      MANILA_DISTRICTS.map((district) =>
        fetchCurrentThreshold(token, datasetId, { disease, district }),
      ),
    )
      .then((responses) => {
        if (!isMounted) return;

        const nextResults = {};
        let firstError = "";
        responses.forEach((response, index) => {
          const district = MANILA_DISTRICTS[index];
          if (response.status === "fulfilled") {
            nextResults[district] = response.value?.result || null;
          } else {
            firstError ||= response.reason?.message || `Unable to calculate ${district} threshold`;
          }
        });

        setThresholdResults(nextResults);
        setErrorMessage(Object.keys(nextResults).length ? "" : firstError);
      })
      .catch((error) => {
        if (!isMounted) return;
        setThresholdResults({});
        setErrorMessage(error.message || "Unable to load district thresholds");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [datasetId, disease, token]);

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold text-gray-900">District Observed Threshold Overview</h2>
          <select aria-label="Threshold disease" value={disease} onChange={(event) => setDisease(event.target.value)} className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
            {SURVEILLANCE_DISEASES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Observed cases eligible under the selected disease definition. These are surveillance determinations, not forecasts or general risk classifications.
        </p>
      </div>

      {errorMessage ? (
        <div className="p-5 text-sm text-red-700">{errorMessage}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-5 py-3">District</th>
                <th className="px-5 py-3">Evaluated Period</th>
                <th className="px-5 py-3 text-right">Observed</th>
                <th className="px-5 py-3 text-right">Baseline Years</th>
                <th className="px-5 py-3 text-right">Historical Mean</th>
                <th className="px-5 py-3 text-right">Alert</th>
                <th className="px-5 py-3 text-right">Epidemic</th>
                <th className="px-5 py-3">Observed Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MANILA_DISTRICTS.map((district) => {
                const result = thresholdResults[district] || null;
                return (
                  <tr key={district} className="transition hover:bg-blue-50/40">
                    <td className="px-5 py-4 font-semibold text-gray-900">{district}</td>
                    <td className="px-5 py-4 text-gray-600">
                      {loading && !result ? "Calculating…" : formatThresholdPeriod(result)}
                    </td>
                    <td className="px-5 py-4 text-right font-medium text-gray-900">{result?.observedConfirmedCases ?? "—"}</td>
                    <td className="px-5 py-4 text-right text-gray-600">{result ? `${result.baselinePeriods?.length || 0} / 5` : "—"}</td>
                    <td className="px-5 py-4 text-right text-gray-600">{result?.baselineMean ?? "—"}</td>
                    <td className="px-5 py-4 text-right text-gray-600">{result?.alertThreshold ?? "—"}</td>
                    <td className="px-5 py-4 text-right text-gray-600">{result?.epidemicThreshold ?? "—"}</td>
                    <td className="px-5 py-4">
                      {result ? (
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${thresholdStatusClass(result.outcome)}`}>
                          {formatStatusLabel(result.outcome)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">{loading ? "Calculating…" : "Unavailable"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-gray-200 bg-gray-50 px-5 py-3 text-xs text-gray-500">
        Threshold values remain blank until five eligible observations for the same calendar month are available. Each row shows the latest complete month for that district.
      </div>
    </section>
  );
}
