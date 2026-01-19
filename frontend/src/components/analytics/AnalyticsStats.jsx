import { ArrowTrendingUpIcon, ArrowUpRightIcon } from "@heroicons/react/24/outline";

export default function AnalyticsStats({
  thisYearCases,
  totalCases,
  topDistrict,
  topIllness,
  districtsCovered,
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-gray-600">Total Cases This Year</p>
          <ArrowTrendingUpIcon height={20} width={20}/>
        </div>
        <p className="text-3xl">{thisYearCases}</p>
        <div className="flex items-center gap-2 mt-2">
          <ArrowUpRightIcon height={12} width={12} />
          <span className="text-sm text-red-600">Total reports: {totalCases}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <p className="text-sm text-gray-600 mb-2">Top District</p>
        <p className="text-2xl font-semibold">{topDistrict}</p>
        <p className="text-sm text-gray-600 mt-2">Highest case volume (current data)</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <p className="text-sm text-gray-600 mb-2">Top Illness</p>
        <p className="text-2xl font-semibold">{topIllness}</p>
        <p className="text-sm text-gray-600 mt-2">Most frequent diagnosis</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <p className="text-sm text-gray-600 mb-2">Districts Covered</p>
        <p className="text-3xl">{districtsCovered}</p>
        <p className="text-sm text-gray-600 mt-2">Unique districts with reports</p>
      </div>
    </div>
  );
}
