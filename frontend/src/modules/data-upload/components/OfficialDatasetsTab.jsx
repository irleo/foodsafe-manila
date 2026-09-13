import { useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useDatasets } from "../hooks/useDatasets.js";
import UploadDropzone from "./UploadDropzone";
import RecentDatasetsList from "./RecentDatasetsList";
import Spinner from "../../../components/common/Spinner.jsx";
import { delay } from "../utils/delay.js";
import { notify } from "../../../utils/toast.js";
import { getErrorMessage } from "../../../utils/errors.js";

export default function OfficialDatasetsTab() {
  const fileInputRef = useRef(null);
  const uploadInFlightRef = useRef(false);
  const downloadInFlightRef = useRef(new Set());
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);

  const [datasetName, setDatasetName] = useState("");
  const [reportingFrequency, setReportingFrequency] = useState("weekly");
  const [coverageStart, setCoverageStart] = useState("");
  const [coverageEnd, setCoverageEnd] = useState("");
  const [coverageVerified, setCoverageVerified] = useState(false);

  const [validating, setValidating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState("");
  const [templateDownloading, setTemplateDownloading] = useState(false);

  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [showFailed, setShowFailed] = useState(false);
  const statusFilter = showFailed ? "validated,failed" : "validated";

  const {
    recent,
    pagination,
    loadingRecent,
    fetchRecent,
    upload,
    download,
    downloadTemplate,
  } = useDatasets(token, statusFilter);

  const canValidate = useMemo(() => {
    if (!file) return false;
    if (!datasetName.trim()) return false;
    if (!coverageStart || !coverageEnd || coverageStart > coverageEnd) return false;
    if (!coverageVerified) return false;
    return true;
  }, [file, datasetName, coverageEnd, coverageStart, coverageVerified]);

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
      f.name.toLowerCase().endsWith(".xlsx") ||
      f.name.toLowerCase().endsWith(".xls");

    if (!ok) {
      setFile(null);
      setErrorMsg(
        "Unsupported file type. Please upload an Excel workbook (.xlsx/.xls).",
      );
      return;
    }

    setFile(f);

    if (!datasetName.trim()) {
      const base = f.name.replace(/\.(xlsx|xls)$/i, "");
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
    if (uploadInFlightRef.current) return;
    uploadInFlightRef.current = true;
    resetMessages();
    setUploading(true);
    setValidating(true);

    try {
      const result = await notify.promise(
        upload({
          file,
          name: datasetName.trim(),
          reportingFrequency,
          coverageStart,
          coverageEnd,
        }),
        {
          success: (res) =>
            res?.formatType
              ? `Imported (${res.formatType}): ${datasetName}`
              : `Uploaded: ${res?.dataset?.name || datasetName}`,
          error: (error) => getErrorMessage(error, "The file could not be processed."),
        },
      );

      if (
        result?.success !== true ||
        !result?.datasetId ||
        !Number.isFinite(result?.insertedRows)
      ) {
        throw new Error("The server did not confirm a successful dataset import.");
      }

      setStatusMsg(`Imported: ${result.formatType} (${result.insertedRows} records)`);
      setFile(null);
      setCoverageStart("");
      setCoverageEnd("");
      setCoverageVerified(false);
      await fetchRecent();
    } catch (err) {
      setErrorMsg(getErrorMessage(err, "The file could not be processed."));
    } finally {
      uploadInFlightRef.current = false;
      setUploading(false);
      setValidating(false);
    }

    await delay(600);
  };

  const downloadDataset = async (datasetId) => {
    if (downloadInFlightRef.current.has(datasetId)) return;
    downloadInFlightRef.current.add(datasetId);
    setDownloadingId(datasetId);
    resetMessages();
    try {
      const { blob, filename } = await download(datasetId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "dataset.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      notify.error("Dataset is not available.");
    } finally {
      downloadInFlightRef.current.delete(datasetId);
      setDownloadingId((current) => current === datasetId ? "" : current);
    }
  };

  const handleDownloadTemplate = async () => {
    const operationKey = "template";
    if (downloadInFlightRef.current.has(operationKey)) return;
    downloadInFlightRef.current.add(operationKey);
    setTemplateDownloading(true);
    resetMessages();
    try {
      const { blob, filename } = await downloadTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "FoodSafe_Template.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      notify.error("Template is not available.");
    } finally {
      downloadInFlightRef.current.delete(operationKey);
      setTemplateDownloading(false);
    }
  };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="min-w-0 space-y-6">
        <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-xl">Upload official dataset</h2>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={templateDownloading}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
            >
              <Download size={16} />
              {templateDownloading ? "Preparing template…" : "Download template"}
            </button>
          </div>

          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            <div className="font-medium mb-1">Accepted uploads</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="font-medium">Raw health office XLSX</span>: multi-sheet, each sheet = disease. Needs “Report date”, “District”, “Case Classification”.
              </li>
              <li>
                <span className="font-medium">FoodSafe template XLSX</span>: enter district, barangay, disease, report date, classification, and cases. FoodSafe calculates calendar and morbidity fields from the CESU report date.
              </li>
            </ul>
          </div>

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
                required
                type="text"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Q1 2025 Foodborne Disease Data"
              />
            </div>

            <fieldset className="min-w-0 rounded-lg border border-blue-200 bg-blue-50/60 p-4">
              <legend className="px-1 text-sm font-semibold text-blue-950">
                Official reporting coverage
              </legend>
              <p className="text-xs text-blue-700">
                Enter the complete period represented by CESU. These dates establish coverage independently of the earliest and latest valid case rows in the workbook.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="min-w-0 text-sm text-gray-700">
                  Coverage start
                  <input
                    required
                    type="date"
                    value={coverageStart}
                    max={coverageEnd || undefined}
                    onChange={(event) => {
                      setCoverageStart(event.target.value);
                      setCoverageVerified(false);
                    }}
                    className="mt-1 min-h-11 min-w-0 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="min-w-0 text-sm text-gray-700">
                  Coverage end
                  <input
                    required
                    type="date"
                    value={coverageEnd}
                    min={coverageStart || undefined}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => {
                      setCoverageEnd(event.target.value);
                      setCoverageVerified(false);
                    }}
                    className="mt-1 min-h-11 min-w-0 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm"
                  />
                </label>
              </div>
              {coverageStart && coverageEnd && coverageStart > coverageEnd ? (
                <p className="mt-2 text-xs font-medium text-red-700">
                  Coverage end must be on or after coverage start.
                </p>
              ) : null}
            </fieldset>

            <label className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={coverageVerified} onChange={(event) => setCoverageVerified(event.target.checked)} />
              <span>I confirm that CESU reporting was complete for all six Manila districts throughout the selected coverage dates. Covered periods without a case row may therefore be encoded as zero.</span>
            </label>
            <p className="text-xs text-gray-500">
              Rows outside the selected coverage dates will cause validation to fail. Missing periods inside confirmed coverage are treated as zero; periods outside it remain missing.
            </p>

            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
              <p className="text-sm font-semibold text-blue-950">Source and reporting details</p>
              <p className="mt-1 text-xs text-blue-700">CESU is the authoritative source for every official dataset uploaded to FoodSafe.</p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="min-w-0 text-sm text-gray-700">
                  Official source
                  <div className="mt-1 flex min-h-11 w-full min-w-0 items-center rounded-md border border-blue-200 bg-white px-3 py-2.5 font-medium break-words text-blue-950">
                    City Epidemiology and Surveillance Unit (CESU)
                  </div>
                </div>
                <label className="min-w-0 text-sm text-gray-700 md:col-span-2">
                  Reporting frequency
                  <select value={reportingFrequency} onChange={(event) => setReportingFrequency(event.target.value)} className="mt-1 min-h-11 min-w-0 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm">
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly historical aggregate</option>
                  </select>
                </label>
              </div>
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

      <div className="min-w-0 space-y-6">
        <RecentDatasetsList
          recent={recent}
          pagination={pagination}
          loading={loadingRecent}
          onRefresh={fetchRecent}
          onPageChange={fetchRecent}
          onDownload={downloadDataset}
          downloadingId={downloadingId}
          showFailed={showFailed}
          onShowFailedChange={setShowFailed}
        />
      </div>
    </div>
  );
}
