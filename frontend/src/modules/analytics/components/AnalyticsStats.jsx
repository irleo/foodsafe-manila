import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
} from "@heroicons/react/24/outline";

function ComparisonBar({ label, value, maxValue, emphasized = false }) {
  const width = maxValue > 0 ? Math.max((value / maxValue) * 100, value > 0 ? 3 : 0) : 0;

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 text-sm">
      <span className="w-10 text-slate-600">{label || "—"}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${emphasized ? "bg-[#134c8c]" : "bg-blue-300"}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="min-w-10 text-right font-medium tabular-nums text-slate-800">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

export default function AnalyticsStats({
  caseStatusLabel,
  dataIdentity = "official",
  latestYear,
  latestYearCases,
  previousYear,
  previousYearCases,
  topDistrict,
  topDisease,
  districtsCovered,
  yoyPct,
  hasComparablePeriod = true,
  comparisonIsPartial = false,
}) {
  const hasYoY = Number.isFinite(yoyPct);
  const isReportData = dataIdentity === "report";
  const metricLabel = isReportData
    ? "Citizen Reports"
    : caseStatusLabel === "All Included"
      ? "Official Cases"
      : `${caseStatusLabel} Cases`;
  const maxYearValue = Math.max(latestYearCases, previousYearCases, 0);

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 analytics-print-grid analytics-stats-print-grid">
      <article className="flex min-h-56 flex-col rounded-xl border border-blue-200 bg-white p-5 shadow-sm analytics-print-block sm:p-6">
        <p className="text-sm text-slate-600">
          {latestYear ? `${metricLabel} in ${latestYear}` : metricLabel}
        </p>
        <p className="mt-2 text-4xl font-semibold tabular-nums text-slate-950">
          {latestYearCases.toLocaleString()}
        </p>
        <div className="mt-2 flex min-h-5 items-center gap-1.5 text-sm font-medium text-[#134c8c]">
          {hasYoY ? (
            <>
              {yoyPct >= 0 ? (
                <ArrowUpRightIcon className="h-4 w-4" />
              ) : (
                <ArrowDownRightIcon className="h-4 w-4" />
              )}
              <span>
                {Math.abs(yoyPct).toFixed(1)}% vs {comparisonIsPartial ? "same period in " : ""}{previousYear}
              </span>
            </>
          ) : (
            <span className="text-slate-500">Year-over-year comparison unavailable</span>
          )}
        </div>

        {hasComparablePeriod ? (
          <div className="mt-auto space-y-3 pt-7">
            <ComparisonBar
              label={previousYear}
              value={previousYearCases}
              maxValue={maxYearValue}
            />
            <ComparisonBar
              label={latestYear}
              value={latestYearCases}
              maxValue={maxYearValue}
              emphasized
            />
          </div>
        ) : (
          <p className="mt-auto pt-7 text-sm text-slate-500">
            The dataset does not cover the matching period in {previousYear}.
          </p>
        )}
      </article>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <article className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm analytics-print-block sm:col-span-2">
          <p className="text-sm text-slate-600">
            Highest {isReportData ? "Report" : "Case"} Concentration
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{topDistrict}</p>
        </article>

        <article className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm analytics-print-block">
          <p className="text-sm text-slate-600">Most Recorded Condition</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{topDisease}</p>
        </article>

        <article className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm analytics-print-block">
          <p className="text-sm text-slate-600">Districts Covered</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
            {districtsCovered.toLocaleString()}
          </p>
        </article>
      </div>
    </section>
  );
}
