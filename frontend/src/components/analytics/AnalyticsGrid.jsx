import SwitchableYearlyChart from "../charts/SwitchableYearlyChart";
import DiseasePieChart from "../charts/DiseasePieChart.jsx";
import DistrictBarChart from "../charts/DistrictBarChart";
import DiseaseTrendStackedAreaChart from "../charts/DiseaseTrendStackedAreaChart.jsx";
import DistrictStatisticsTable from "../tables/DistrictStatisticsTable.jsx";

export default function AnalyticsGrid({
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
          title="Reported, Suspected, and Validated / Confirmed Cases Over Time"
          data={monthlyTimelineData}
        />
        <p className="print-only mt-2 text-sm text-gray-700">
          This graph compares reported, suspected, and confirmed case volume by
          month to highlight changes and possible outbreak periods.
        </p>
      </div>

      <div className="analytics-print-block">
        <DistrictBarChart data={districtData} title="Validated / Confirmed Case Distribution by District" />
        <p className="print-only mt-2 text-sm text-gray-700">
          This graph ranks districts by reported case count, helping identify
          areas with the highest observed burden.
        </p>
      </div>

      <div className="analytics-print-block">
        <DiseasePieChart
          data={diseaseData}
          title="Validated / Confirmed Disease Distribution"
        />
        <p className="print-only mt-2 text-sm text-gray-700">
          This chart compares diseases by share of validated/confirmed cases, showing which
          illnesses make up the largest portions of the dataset.
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
