import { modelLabel } from "../utils/predictionModelView";

function displayMetric(value, suffix = "") {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(2)}${suffix}` : "—";
}

export default function EvaluationTable({ evaluation }) {
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
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-140">
          <thead className="bg-gray-200 text-sm text-gray-600">
            <tr>
              <th className="p-4 text-left font-medium">Metric</th>
              <th className="bg-blue-200 p-4 text-right font-medium text-blue-800">
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
                className={`border-t border-gray-200 ${row.primary ? "bg-blue-50/40 font-semibold" : ""}`}
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
