import SwitchableYearlyChart from "../charts/SwitchableYearlyChart";
import DiseasePieChart from "../charts/DiseasePieChart.jsx";
import DistrictBarChart from "../charts/DistrictBarChart";
import DiseaseTrendStackedAreaChart from "../charts/DiseaseTrendStackedAreaChart.jsx";
import DistrictThresholdOverview from "./DistrictThresholdOverview.jsx";

export default function AnalyticsGrid({
  caseStatusLabel,
  caseStatus,
  monthlyTimelineData,
  diseaseData,
  districtData,
  diseaseTrendData,
  diseaseTrendKeys,
  token,
  datasetId,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 analytics-print-grid">
      <div className="lg:col-span-2 analytics-print-block">
        <SwitchableYearlyChart
          title="Cases Over Time"
          data={monthlyTimelineData}
          movingAverageStatus={caseStatus}
        />
        <p className="print-only mt-2 text-sm text-gray-700">
          This comparison graph shows reported, suspected, probable, and
          confirmed case volume by month, with 3-month and 6-month moving
          averages for the selected status.
        </p>
      </div>

      <div className="analytics-print-block">
        <DistrictBarChart
          data={districtData}
          title={`${caseStatusLabel} Case Distribution by District`}
        />
        <p className="print-only mt-2 text-sm text-gray-700">
          This graph compares districts by {caseStatusLabel.toLowerCase()} case
          count, helping identify areas with the highest observed concentration.
        </p>
      </div>

      <div className="analytics-print-block">
        <DiseasePieChart
          data={diseaseData}
          title={`${caseStatusLabel} Disease Distribution`}
        />
        <p className="print-only mt-2 text-sm text-gray-700">
          This chart compares the latest-year disease share and each disease's
          relative change from the previous year for {caseStatusLabel.toLowerCase()} cases.
        </p>
      </div>

      <div className="lg:col-span-2 analytics-print-block">
        <DiseaseTrendStackedAreaChart
          data={diseaseTrendData}
          keys={diseaseTrendKeys}
          title={`Monthly Disease Trends — ${caseStatusLabel} Cases`}
        />
        <p className="print-only mt-2 text-sm text-gray-700">
          This graph compares disease-specific trajectories and highlights the
          latest month-over-month movement for the leading diseases.
        </p>
      </div>
      <div className="lg:col-span-2 analytics-print-block">
        <DistrictThresholdOverview token={token} datasetId={datasetId} />
      </div>
    </div>
  );
}
