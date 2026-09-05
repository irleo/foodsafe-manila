import { useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useDatasets } from "../../hooks/useDatasets.js";
import UploadDropzone from "../datasets/UploadDropzone";
import RecentDatasetsList from "../datasets/RecentDatasetsList";
import Spinner from "../Spinner.jsx";
import { delay } from "../../utils/delay.js";
import { notify } from "../../utils/toast.js";
import { getErrorMessage } from "../../utils/errors.js";

const MANILA_DISTRICTS = Array.from({ length: 6 }, (_, index) => `District ${index + 1}`);

export default function OfficialDatasetsTab() {
  const fileInputRef = useRef(null);
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);

  const [datasetName, setDatasetName] = useState("");
  const [reportingFrequency, setReportingFrequency] = useState("weekly");
  const [coverageVerified, setCoverageVerified] = useState(false);

  const [validating, setValidating] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    if (!coverageVerified) return false;
    return true;
  }, [file, datasetName, coverageVerified]);

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
    resetMessages();
    setUploading(true);
    setValidating(true);

    try {
      const result = await notify.promise(
        upload({
          file,
          name: datasetName.trim(),
          reportingFrequency,
          districtCoverage: MANILA_DISTRICTS.map((district) => ({
            district,
            verifiedComplete: true,
          })),
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
      await fetchRecent();
    } catch (err) {
      setErrorMsg(getErrorMessage(err, "The file could not be processed."));
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
      a.download = filename || "dataset.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      notify.error("Dataset is not available.");
    }
  };

  const handleDownloadTemplate = async () => {
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
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-xl">Upload official dataset</h2>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
            >
              <Download size={16} />
              Download template
            </button>
          </div>

          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            <div className="font-medium mb-1">Accepted uploads</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="font-medium">Raw health office XLSX</span>: multi-sheet, each sheet = disease. Needs “Report date”, “District”, “Case Classification”.
              </li>
              <li>
                <span className="font-medium">FoodSafe template XLSX</span>: enter district, barangay, disease, date of onset, classification, cases, and optional date reported. FoodSafe calculates morbidity fields automatically.
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

            <label className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={coverageVerified} onChange={(event) => setCoverageVerified(event.target.checked)} />
              <span>I confirm that reporting was complete for each included district throughout the period detected from the workbook. Covered weeks without a case row may therefore be encoded as zero.</span>
            </label>
            <p className="text-xs text-gray-500">
              Each district uses its own earliest and latest valid record dates. Without this confirmation, missing rows cannot safely be interpreted as zero.
            </p>

            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
              <p className="text-sm font-semibold text-blue-950">Source and reporting details</p>
              <p className="mt-1 text-xs text-blue-700">CESU is the authoritative source for every official dataset uploaded to FoodSafe.</p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="text-sm text-gray-700">
                  Official source
                  <div className="mt-1 w-max flex min-h-11 items-center rounded-md border border-blue-200 bg-white px-3 py-2.5 font-medium text-blue-950">
                    City Epidemiology and Surveillance Unit (CESU)
                  </div>
                </div>
                <label className="text-sm text-gray-700 md:col-span-2">
                  Reporting frequency
                  <select value={reportingFrequency} onChange={(event) => setReportingFrequency(event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm">
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

      <div className="space-y-6">
        <RecentDatasetsList
          recent={recent}
          pagination={pagination}
          loading={loadingRecent}
          onRefresh={fetchRecent}
          onPageChange={fetchRecent}
          onDownload={downloadDataset}
          showFailed={showFailed}
          onShowFailedChange={setShowFailed}
        />
      </div>
    </div>
  );
}
