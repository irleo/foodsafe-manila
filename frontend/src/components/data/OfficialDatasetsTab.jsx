import { useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useDatasets } from "../../hooks/useDatasets.js";
import UploadDropzone from "../datasets/UploadDropzone";
import RecentDatasetsList from "../datasets/RecentDatasetsList";
import Spinner from "../Spinner.jsx";
import { delay } from "../../utils/delay.js";
import { notify } from "../../utils/toast.js";

export default function OfficialDatasetsTab() {
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

  const [showFailed, setShowFailed] = useState(false);
  const statusFilter = showFailed ? "validated,failed" : "validated";

  const { recent, loadingRecent, fetchRecent, upload, download } = useDatasets(
    token,
    statusFilter,
  );

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
    setUploading(true);
    setValidating(true);

    try {
      const result = await notify.promise(
        upload({
          file,
          name: datasetName.trim(),
          coverageStart,
          coverageEnd,
          dataSource,
        }),
        {
          success: (res) => `Uploaded: ${res?.dataset?.name || datasetName}`,
          error: (e) => e?.message || "Upload failed.",
        },
      );

      setStatusMsg(
        `Uploaded and validated: ${result?.dataset?.name || datasetName}`,
      );
      setFile(null);
      await fetchRecent();
    } catch (err) {
      setErrorMsg(err.message || "Upload failed.");
    } finally {
      setUploading(false);
      setValidating(false);
    }

    await delay(600);
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="mb-4 font-semibold text-xl">Upload official dataset</h2>

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
              <label className="block text-sm mb-2">Dataset name</label>
              <input
                type="text"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Q1 2025 Foodborne Disease Data"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Coverage start
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
                  Coverage end
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

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">Data source</p>
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
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {(uploading || validating) && (
                <span className="inline-flex h-4 w-4">
                  <Spinner />
                </span>
              )}
              {uploading
                ? "Uploading..."
                : validating
                  ? "Validating..."
                  : "Validate dataset"}
            </button>
          </div>

          {(errorMsg || statusMsg) && (
            <div
              className={`mt-4 rounded-lg border p-3 text-sm ${
                errorMsg
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-green-200 bg-green-50 text-green-700"
              }`}
            >
              {errorMsg || statusMsg}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <RecentDatasetsList
          recent={recent}
          loading={loadingRecent}
          onRefresh={fetchRecent}
          onDownload={downloadDataset}
          showFailed={showFailed}
          onShowFailedChange={setShowFailed}
        />
      </div>
    </div>
  );
}