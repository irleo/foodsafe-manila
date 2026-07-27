import SwitchableYearlyChart from "../charts/SwitchableYearlyChart";
import DiseasePieChart from "../charts/DiseasePieChart.jsx";
import DistrictBarChart from "../charts/DistrictBarChart";
import RiskLevelDonutChart from "../charts/RiskLevelDonutChart.jsx";
import DiseaseTrendStackedAreaChart from "../charts/DiseaseTrendStackedAreaChart.jsx";
import DistrictStatisticsTable from "../tables/DistrictStatisticsTable.jsx";

export default function AnalyticsGrid({
  yearlyTimelineData,
  diseaseData,
  districtData,
  districtStats,
  riskLevelData,
  diseaseTrendData,
  diseaseTrendKeys,
  colors,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 analytics-print-grid">
      <div className="lg:col-span-2 analytics-print-block">
        <SwitchableYearlyChart
          title="Cases Over Time"
          data={yearlyTimelineData}
        />
        <p className="print-only mt-2 text-sm text-gray-700">
          This graph shows total case volume by year to highlight long-term
          increases, decreases, and possible outbreak periods.
        </p>
      </div>

      <div className="analytics-print-block">
        <DistrictBarChart data={districtData} title="Top Cases (by district)" />
        <p className="print-only mt-2 text-sm text-gray-700">
          This graph ranks districts by reported case count, helping identify
          areas with the highest observed burden.
        </p>
      </div>

      <div className="analytics-print-block">
        <DiseasePieChart
          data={diseaseData}
          colors={colors}
          title="Disease Distribution"
        />
        <p className="print-only mt-2 text-sm text-gray-700">
          This chart compares diseases by share of total cases, showing which
          illnesses make up the largest portions of the dataset.
        </p>
      </div>

      <div className="analytics-print-block">
        <RiskLevelDonutChart
          data={riskLevelData}
          colors={colors}
          title="Risk Level Analysis"
        />
        <p className="print-only mt-2 text-sm text-gray-700">
          This chart groups districts by risk band using case-count thresholds,
          so the printed report summarizes how many areas fall into each level.
        </p>
      </div>

      <div className="analytics-print-block">
        <DiseaseTrendStackedAreaChart
          data={diseaseTrendData}
          keys={diseaseTrendKeys}
          title="Disease Trends Over Time"
        />
        <p className="print-only mt-2 text-sm text-gray-700">
          This graph tracks disease-specific trends over time and shows whether
          changes are broad-based or driven by specific diseases.
        </p>
      </div>
      <div className="lg:col-span-2 analytics-print-block">
        <DistrictStatisticsTable data={districtStats} />
      </div>
    </div>
  );
}
