import { useMemo, useRef, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../context/AuthContext";

import { useDatasets } from "../hooks/useDatasets.js";
import UploadDropzone from "../components/datasets/UploadDropzone";
import RecentDatasetsList from "../components/datasets/RecentDatasetsList";
import Spinner from "../components/Spinner.jsx";

export default function DatasetUpload() {
  const fileInputRef = useRef(null);
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);

  const [datasetName, setDatasetName] = useState("");
  const [coverageStart, setCoverageStart] = useState("");
  const [coverageEnd, setCoverageEnd] = useState("");
  const [dataSource, setDataSource] = useState("Department of Health (DOH)");

  const [validating, setValidating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const { recent, loadingRecent, fetchRecent, upload, download } =
    useDatasets(token);

  const canValidate = useMemo(() => {
    if (!file) return false;
    if (!datasetName.trim()) return false;
    if (!coverageStart || !coverageEnd) return false;
    if (new Date(coverageStart) > new Date(coverageEnd)) return false;
    return true;
  }, [file, datasetName, coverageStart, coverageEnd]);

  const resetMessages = () => {
    setErrorMsg("");
    setStatusMsg("");
  };

  const pickFile = () => {
    resetMessages();
    fileInputRef.current?.click();
  };

  const onFileSelected = (f) => {
    if (!f) return;

    const ok =
      f.name.toLowerCase().endsWith(".csv") ||
      f.name.toLowerCase().endsWith(".xlsx") ||
      f.name.toLowerCase().endsWith(".xls");

    if (!ok) {
      setFile(null);
      setErrorMsg(
        "Unsupported file type. Please upload CSV or Excel (.xlsx/.xls).",
      );
      return;
    }

    setFile(f);

    if (!datasetName.trim()) {
      const base = f.name.replace(/\.(csv|xlsx|xls)$/i, "");
      setDatasetName(base);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    resetMessages();

    const dropped = e.dataTransfer?.files?.[0];
    if (dropped) onFileSelected(dropped);
  };

  const validateAndUpload = async () => {
    resetMessages();
    setValidating(true);
    setUploading(true);

    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      const result = await upload({
        file,
        name: datasetName.trim(),
        coverageStart,
        coverageEnd,
        dataSource,
      });

      setStatusMsg(
        `Uploaded and validated: ${result?.dataset?.name || datasetName}`,
      );
      setFile(null);
      await fetchRecent();
    } catch (err) {
      setErrorMsg(err.message || "Upload failed.");
    } finally {
      setValidating(false);
      setUploading(false);
    }
  };

  const downloadDataset = async (datasetId) => {
    resetMessages();
    try {
      const { blob, filename } = await download(datasetId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "dataset.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg(err.message || "Download failed.");
    }
  };

  return (
    <div className="space-y-6">
      {/* header + alert ... */}
      <div>
        <h1 className="text-2xl font-bold">Dataset Upload</h1>
        <p className="text-gray-600 mt-1">Upload and manage datasets here.</p>
      </div>

      {(errorMsg || statusMsg) && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            errorMsg
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>{errorMsg || statusMsg}</div>
            <button
              className="p-1 rounded hover:bg-black/5"
              onClick={() => {
                setErrorMsg("");
                setStatusMsg("");
              }}
              aria-label="Dismiss"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Upload card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="mb-4 font-semibold text-xl">Upload Dataset</h2>

            <UploadDropzone
              dragActive={dragActive}
              setDragActive={setDragActive}
              file={file}
              fileInputRef={fileInputRef}
              pickFile={pickFile}
              onFileSelected={onFileSelected}
              onDrop={handleDrop}
              onRemoveFile={() => setFile(null)}
            />

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm mb-2">Dataset Name</label>
                <input
                  type="text"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Q1 2025 Foodborne Illness Data"
                />
              </div>

              {/* Coverage Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Coverage Start
                  </label>
                  <input
                    type="date"
                    value={coverageStart}
                    onChange={(e) => setCoverageStart(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Coverage End
                  </label>
                  <input
                    type="date"
                    value={coverageEnd}
                    onChange={(e) => setCoverageEnd(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {coverageStart &&
                coverageEnd &&
                new Date(coverageStart) > new Date(coverageEnd) && (
                  <p className="text-xs text-red-600">
                    Coverage start date cannot be after the end date.
                  </p>
                )}

              {/* Dataset Source */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">Data Source</p>
                <input
                  type="text"
                  value={dataSource}
                  onChange={(e) => setDataSource(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={validateAndUpload}
                disabled={!canValidate || uploading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700
             disabled:opacity-50 disabled:cursor-not-allowed
             flex items-center justify-center gap-2"
              >
                {(uploading || validating) && <Spinner />}
                {uploading
                  ? "Uploading..."
                  : validating
                    ? "Validating..."
                    : "Validate Dataset"}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <RecentDatasetsList
            recent={recent}
            loading={loadingRecent}
            onRefresh={fetchRecent}
            onDownload={downloadDataset}
          />
        </div>
      </div>
    </div>
  );
}
