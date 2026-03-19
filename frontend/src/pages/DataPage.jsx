import { useState } from "react";
import { Database, FileText } from "lucide-react";
import OfficialDatasetsTab from "../components/data/OfficialDatasetsTab";
import ReportLogsTab from "../components/data/ReportLogsTab";

const TABS = {
  DATASETS: "datasets",
  REPORTS: "reports",
};

export default function Data() {
  const [activeTab, setActiveTab] = useState(TABS.DATASETS);

  const tabBase =
    "flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200";
  const activeTabClass = "bg-blue-600 text-white shadow-sm";
  const inactiveTabClass = "bg-gray-100 text-gray-700 hover:text-gray-900 hover:bg-gray-200";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data</h1>
        <p className="mt-1 text-gray-600">
          Manage official datasets and review citizen-submitted report logs
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-gray-100 p-1">
        <nav className="grid grid-cols-2 gap-1">
          <button
            onClick={() => setActiveTab(TABS.DATASETS)}
            className={`${tabBase} ${
              activeTab === TABS.DATASETS ? activeTabClass : inactiveTabClass
            }`}
          >
            <Database className="h-4 w-4" />
            <span>Official datasets</span>
          </button>

          <button
            onClick={() => setActiveTab(TABS.REPORTS)}
            className={`${tabBase} ${
              activeTab === TABS.REPORTS ? activeTabClass : inactiveTabClass
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Report logs</span>
          </button>
        </nav>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {activeTab === TABS.DATASETS ? (
          <OfficialDatasetsTab />
        ) : (
          <ReportLogsTab />
        )}
      </div>
    </div>
  );
}