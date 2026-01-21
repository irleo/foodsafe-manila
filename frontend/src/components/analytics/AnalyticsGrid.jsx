import SwitchableTimelineChart from "../charts/SwitchableTimelineChart";
import IllnessPieChart from "../charts/DiseasePieChart.jsx";
import TrendsAreaChart from "../charts/TrendsAreaChart";
import DistrictBarChart from "../charts/DistrictBarChart";
import SeverityDonutChart from "../charts/SeverityDonutChart";
import DistrictStatisticsTable from "../tables/DistrictStatisticsTable.jsx";

export default function AnalyticsGrid({
  dailyTimelineData,
  monthlyTrendData,
  illnessData,
  severityData,
  districtData,
  districtStats,
  colors,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="lg:col-span-2">
        <SwitchableTimelineChart data={dailyTimelineData} />
      </div>

      <IllnessPieChart data={illnessData} colors={colors} />
      <TrendsAreaChart data={monthlyTrendData} />
      <DistrictBarChart data={districtData} />
      <SeverityDonutChart data={severityData} colors={colors} />

      <div className="lg:col-span-2">
        <DistrictStatisticsTable data={districtStats} />
      </div>
    </div>
  );
}
