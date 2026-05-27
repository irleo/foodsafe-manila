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
      </div>

      <div className="analytics-print-block">
        <DistrictBarChart data={districtData} title="Top Cases (by district)" />
      </div>

      <div className="analytics-print-block">
        <DiseasePieChart
          data={diseaseData}
          colors={colors}
          title="Disease Distribution"
        />
      </div>

      <div className="analytics-print-block">
        <RiskLevelDonutChart
          data={riskLevelData}
          colors={colors}
          title="Risk Level Analysis"
        />
      </div>

      <div className="analytics-print-block">
        <DiseaseTrendStackedAreaChart
          data={diseaseTrendData}
          keys={diseaseTrendKeys}
          title="Disease Trends Over Time"
        />
      </div>
      <div className="lg:col-span-2 analytics-print-block">
        <DistrictStatisticsTable data={districtStats} />
      </div>
    </div>
  );
}
