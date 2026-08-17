import OfficialDatasetsTab from "../components/data/OfficialDatasetsTab";

export default function Data() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data Upload</h1>
        <p className="mt-1 text-gray-600">
          Upload and manage official case datasets.
        </p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <OfficialDatasetsTab />
      </div>
    </div>
  );
}
