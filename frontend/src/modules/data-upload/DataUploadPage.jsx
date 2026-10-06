import OfficialDatasetsTab from "./components/OfficialDatasetsTab";

export default function DataUploadPage() {
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data Upload</h1>
        <p className="mt-1 text-gray-600">
          Upload and manage official case datasets.
        </p>
      </div>
      <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-6">
        <OfficialDatasetsTab />
      </div>
    </div>
  );
}
