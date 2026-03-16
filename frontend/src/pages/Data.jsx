import { useState } from "react";
import OfficialDatasetsTab from "../components/data/OfficialDatasetsTab";
import ReportLogsTab from "../components/data/ReportLogsTab";

const TABS = {
  DATASETS: "datasets",
  REPORTS: "reports",
};

export default function Data() {
  const [activeTab, setActiveTab] = useState(TABS.DATASETS);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data</h1>
        <p className="text-gray-600 mt-1">
          Manage official datasets and review citizen-submitted report logs
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex justify-center space-x-8">
          <button
            onClick={() => setActiveTab(TABS.DATASETS)}
            className={`pb-3 text-sm font-medium border-b-2 transition-all duration-200 w-100 ${
              activeTab === TABS.DATASETS
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Official datasets
          </button>

          <button
            onClick={() => setActiveTab(TABS.REPORTS)}
            className={`pb-3 text-sm font-medium border-b-2 transition-all duration-200 w-100 ${
              activeTab === TABS.REPORTS
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Report logs
          </button>
        </nav>
      </div>

      {activeTab === TABS.DATASETS ? (
        <OfficialDatasetsTab />
      ) : (
        <ReportLogsTab />
      )}
    </div>
  );
}