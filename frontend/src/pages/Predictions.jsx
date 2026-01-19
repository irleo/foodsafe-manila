import { useMemo, useState } from "react";
import WeeklyForecastChart from "../components/charts/WeeklyForecastChart";
import WeeklyActualVsPredictedBarChart from "../components/charts/WeeklyActualVsPredictedBarChart";
import { mockReports } from "../data/mockReports";

import {
  buildWeeklyCaseHistory,
  buildWeeklyForecast,
  buildActualVsPredicted,
  buildDistrictRiskPoints,
  buildAverageRiskScore,
  countHighRiskDistricts,
  buildNextPredictionLabel,
} from "../utils/predictionBuilders";

export default function Predictions() {
  const [refreshKey, setRefreshKey] = useState(0);

  // 1) District risk points
  const districtRiskPoints = useMemo(
    () => buildDistrictRiskPoints(mockReports),
    []
  );

  // 2) Average risk score
  const avgRiskScore = useMemo(
    () => buildAverageRiskScore(districtRiskPoints),
    [districtRiskPoints]
  );

  // 3) High risk districts
  const highRiskDistricts = useMemo(
    () => countHighRiskDistricts(districtRiskPoints),
    [districtRiskPoints]
  );

  // 4) Weekly history (depends on refreshKey if you regenerate)
  const weeklyHistory = useMemo(
    () => buildWeeklyCaseHistory(mockReports),
    [refreshKey]
  );

  // 5) Forecast (depends on weeklyHistory)
  const forecastData = useMemo(
    () =>
      buildWeeklyForecast(weeklyHistory, {
        horizonWeeks: 6,
        window: 6,
        z: 1.0,
      }),
    [weeklyHistory]
  );

  // 6) Next prediction label (depends on forecastData)
  const nextPredictionLabel = useMemo(
    () => buildNextPredictionLabel(forecastData, new Date()),
    [forecastData]
  );

  // 7) Compare data (depends on forecastData; no need to compute once)
  const compareData = useMemo(
    () =>
      buildActualVsPredicted({
        reports: mockReports,
        forecast: forecastData,
      }),
    [forecastData]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold space-y-6">Predictions</h1>
          <p className="text-gray-600 mt-1">
            Forecasting of disease outbreaks risks.
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          onClick={() => setRefreshKey((k) => k + 1)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-refresh-cw w-4 h-4"
            data-fg-cxzx8="1.39:1.11638:/src/app/pages/Predictions.tsx:75:11:2722:71:e:RefreshCw::::::BIqG"
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
            <path d="M21 3v5h-5"></path>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
            <path d="M8 16H3v5"></path>
          </svg>
          Generate Prediction
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-trending-up w-5 h-5 text-blue-500"
            data-fg-cxzx14="1.39:1.11638:/src/app/pages/Predictions.tsx:84:13:3131:48:e:TrendingUp::::::D9DP"
          >
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
            <polyline points="16 7 22 7 22 13"></polyline>
          </svg>
          <p className="text-sm text-gray-600">Average Risk Score</p>
          <p className="text-3xl">{avgRiskScore}%</p>
          <p className="text-sm text-gray-600 mt-2">Across all districts</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-triangle-alert w-5 h-5 text-red-500"
            data-fg-cxzx24="1.39:1.11638:/src/app/pages/Predictions.tsx:93:13:3572:50:e:AlertTriangle::::::B5Nd"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path>
            <path d="M12 9v4"></path>
            <path d="M12 17h.01"></path>
          </svg>
          <p className="text-sm text-gray-600">High Risk Districts</p>
          <p className="text-3xl">{highRiskDistricts}</p>
          <p className="text-sm text-gray-600 mt-2">
            Require immediate attention
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-calendar w-5 h-5 text-green-500"
            data-fg-cxzx33="1.39:1.11638:/src/app/pages/Predictions.tsx:102:13:4019:47:e:Calendar::::::hMX"
          >
            <path d="M8 2v4"></path>
            <path d="M16 2v4"></path>
            <rect width="18" height="18" x="3" y="4" rx="2"></rect>
            <path d="M3 10h18"></path>
          </svg>
          <p className="text-sm text-gray-600">Next Prediction</p>
          <p className="text-3xl">{nextPredictionLabel}</p>
          <p className="text-sm text-gray-600 mt-2">Auto-scheduled</p>
        </div>
      </div>

      <WeeklyForecastChart data={forecastData} />
      <WeeklyActualVsPredictedBarChart data={compareData} />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-lg">District Risk Assessment</h2>
          <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="all">All Districts</option>
            <option value="District 1 - Tondo">District 1 - Tondo</option>
            <option value="District 2 - Binondo">District 2 - Binondo</option>
            <option value="District 3 - Santa Cruz">District 3 - Santa Cruz</option>
            <option value="District 4 - Sampaloc">District 4 - Sampaloc</option>
            <option value="District 5 - San Miguel">District 5 - San Miguel</option>
            <option value="District 6 - Malate">District 6 - Malate</option>
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="border-2 rounded-xl p-6 bg-red-100 text-red-700 border-red-300">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600">District</p>
                <p>Tondo</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-triangle-alert w-5 h-5 text-red-600">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path>
                <path d="M12 9v4"></path>
                <path d="M12 17h.01"></path>
              </svg>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">
                  Risk Score
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-white rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-red-500 w-[87.6962%]"></div>
                  </div>
                  <span className="text-sm">88%</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Predicted Cases</p>
                <p className="text-2xl">45</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Risk Level</p>
                <p className="capitalize">high</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Prediction Date</p>
                <p className="text-sm">2026-02-14</p>
              </div>

            </div>
          </div>
          <div className="border-2 rounded-xl p-6 bg-green-100 text-green-700 border-green-300">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600">District</p>
                <p>Binondo</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">
                  Risk Score
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-white rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-green-500 w-[54.6962%]"></div>
                  </div>
                  <span className="text-sm">55%</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Predicted Cases</p>
                <p className="text-2xl">45</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Risk Level</p>
                <p className="capitalize">low</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Prediction Date</p>
                <p className="text-sm">2026-02-14</p>
              </div>

            </div>
          </div>
          <div className="border-2 rounded-xl p-6 bg-red-100 text-red-700 border-red-300">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600">District</p>
                <p>Santa Cruz</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-triangle-alert w-5 h-5 text-red-600">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path>
                <path d="M12 9v4"></path>
                <path d="M12 17h.01"></path>
              </svg>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">
                  Risk Score
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-white rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-red-500 w-[15.6962%]"></div>
                  </div>
                  <span className="text-sm">16%</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Predicted Cases</p>
                <p className="text-2xl">24</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Risk Level</p>
                <p className="capitalize">high</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Prediction Date</p>
                <p className="text-sm">2026-02-14</p>
              </div>

            </div>
          </div>
          <div className="border-2 rounded-xl p-6 bg-yellow-100 text-yellow-700 border-yellow-300">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600">District</p>
                <p>Sampaloc</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">
                  Risk Score
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-white rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-yellow-500 w-[34.6962%]"></div>
                  </div>
                  <span className="text-sm">35%</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Predicted Cases</p>
                <p className="text-2xl">40</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Risk Level</p>
                <p className="capitalize">medium</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Prediction Date</p>
                <p className="text-sm">2026-02-14</p>
              </div>

            </div>
          </div>
          <div className="border-2 rounded-xl p-6 bg-green-100 text-green-700 border-green-300">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600">District</p>
                <p>San Miguel</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">
                  Risk Score
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-white rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-green-500 w-[54.6962%]"></div>
                  </div>
                  <span className="text-sm">55%</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Predicted Cases</p>
                <p className="text-2xl">45</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Risk Level</p>
                <p className="capitalize">low</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Prediction Date</p>
                <p className="text-sm">2026-02-14</p>
              </div>

            </div>
          </div>
          <div className="border-2 rounded-xl p-6 bg-green-100 text-green-700 border-green-300">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600">District</p>
                <p>Malate</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">
                  Risk Score
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-white rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-green-500 w-[54.6962%]"></div>
                  </div>
                  <span className="text-sm">55%</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Predicted Cases</p>
                <p className="text-2xl">45</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Risk Level</p>
                <p className="capitalize">low</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Prediction Date</p>
                <p className="text-sm">2026-02-14</p>
              </div>

            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-lg">Prediction History</h2>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-download w-4 h-4">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" x2="12" y1="15" y2="3"></line>
            </svg>
            Export
          </button>
        </div>
        <div className="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left p-3">Date</th>
                <th class="text-left p-3">District</th>
                <th class="text-left p-3">Predicted Cases</th>
                <th class="text-left p-3">Actual Cases</th>
                <th class="text-left p-3">Accuracy</th>
                <th class="text-left p-3">Risk Level</th>
              </tr>
            </thead>
              <tbody>
                <tr class="border-b border-gray-100">
                  <td class="p-3">2026-01-18</td>
                  <td class="p-3">Tondo</td>
                  <td class="p-3">45</td>
                  <td class="p-3">53</td>
                  <td class="p-3">
                    <span className="text-sm text-yellow-600">84.9%</span>
                  </td>
                  <td class="p-3">
                    <span className="px-3 py-1 rounded-full text-sm capitalize bg-red-100 text-red-700 border-red-300" >high</span>
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="p-3">2026-01-18</td>
                  <td className="p-3">Binondo</td>
                  <td className="p-3">72</td>
                  <td className="p-3">66</td>
                  <td className="p-3">
                    <span class="text-sm text-green-600">90.9%</span>
                  </td>
                  <td className="p-3">
                    <span className="px-3 py-1 rounded-full text-sm capitalize bg-green-100 text-green-700 border-green-300">low</span>
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="p-3">2026-01-18</td>
                  <td className="p-3">Santa Cruz</td>
                  <td className="p-3">24</td>
                  <td className="p-3">27</td>
                  <td className="p-3">
                    <span className="text-sm text-yellow-600">88.9%</span>
                  </td>
                  <td className="p-3">
                    <span className="px-3 py-1 rounded-full text-sm capitalize bg-red-100 text-red-700 border-red-300" >high</span>
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="p-3">2026-01-18</td>
                  <td className="p-3">Sampaloc</td>
                  <td className="p-3">40</td>
                  <td className="p-3">31</td>
                  <td className="p-3">
                    <span className="text-sm text-red-600">71.0%</span>
                  </td>
                  <td className="p-3">
                    <span className="px-3 py-1 rounded-full text-sm capitalize bg-yellow-100 text-yellow-700 border-yellow-300" >medium</span>
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="p-3">2026-01-18</td>
                  <td className="p-3">San Miguel</td>
                  <td className="p-3">105</td>
                  <td className="p-3">98</td>
                  <td className="p-3">
                    <span className="text-sm text-green-600">92.9%</span>
                  </td>
                  <td className="p-3">
                    <span className="px-3 py-1 rounded-full text-sm capitalize bg-green-100 text-green-700 border-green-300">low</span>
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="p-3">2026-01-18</td>
                  <td className="p-3">Malate</td>
                  <td className="p-3">74</td>
                  <td className="p-3">71</td>
                  <td className="p-3">
                    <span className="text-sm text-green-600" >95.8%</span>
                  </td>
                  <td className="p-3">
                    <span className="px-3 py-1 rounded-full text-sm capitalize bg-green-100 text-green-700 border-green-300">low</span>
                  </td>
                </tr>
              </tbody>
            </table>
        </div>
      </div>
      
    </div>
  );
}
