import SwitchableYearlyChart from "../charts/SwitchableYearlyChart";
import DiseasePieChart from "../charts/DiseasePieChart.jsx";
import DistrictBarChart from "../charts/DistrictBarChart";
import DiseaseTrendStackedAreaChart from "../charts/DiseaseTrendStackedAreaChart.jsx";
import DistrictStatisticsTable from "../tables/DistrictStatisticsTable.jsx";

export default function AnalyticsGrid({
  selectedCaseStatus,
  caseStatusLabel,
  monthlyTimelineData,
  diseaseData,
  districtData,
  districtStats,
  diseaseTrendData,
  diseaseTrendKeys,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 analytics-print-grid">
      <div className="lg:col-span-2 analytics-print-block">
        <SwitchableYearlyChart
          title={`${caseStatusLabel} Cases Over Time`}
          data={monthlyTimelineData}
          selectedStatus={selectedCaseStatus}
        />
        <p className="print-only mt-2 text-sm text-gray-700">
          This graph shows {caseStatusLabel.toLowerCase()} case volume by month
          to highlight changes over time.
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
          This chart compares diseases by share of {caseStatusLabel.toLowerCase()}
          cases, showing which illnesses make up the largest portions of the dataset.
        </p>
      </div>

      <div className="lg:col-span-2 analytics-print-block">
        <DiseaseTrendStackedAreaChart
          data={diseaseTrendData}
          keys={diseaseTrendKeys}
          title={`Disease Trends Over Time — ${caseStatusLabel} Cases`}
        />
        <p className="print-only mt-2 text-sm text-gray-700">
          This graph tracks disease-specific trends over time and shows whether
          changes are broad-based or driven by specific diseases.
        </p>
      </div>
      <div className="lg:col-span-2 analytics-print-block">
        <DistrictStatisticsTable
          data={districtStats}
          caseStatusLabel={caseStatusLabel}
        />
      </div>
    </div>
  );
}
