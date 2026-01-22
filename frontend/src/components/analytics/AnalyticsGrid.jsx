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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="lg:col-span-2">
        <SwitchableYearlyChart
          title="Cases Over Time"
          data={yearlyTimelineData}
        />
      </div>

      <DistrictBarChart 
      data={districtData} title="Top Cases (by district)" />

      <DiseasePieChart
        data={diseaseData}
        colors={colors}
        title="Disease Distribution"
      />

      <RiskLevelDonutChart
        data={riskLevelData}
        colors={colors}
        title="Risk Level Analysis"
      />

      <DiseaseTrendStackedAreaChart
        data={diseaseTrendData}
        keys={diseaseTrendKeys}
        title="Disease Trends Over Time"
      />
      <div className="lg:col-span-2">
        <DistrictStatisticsTable data={districtStats} />
      </div>
    </div>
  );
}
