import ValidationPreview from "./ValidationPreview.jsx";
import { useMemo, useRef, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  CalendarRange,
  Info,
  Lock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useDatasets } from "../hooks/useDatasets.js";
import UploadDropzone from "./UploadDropzone";
import RecentDatasetsList from "./RecentDatasetsList";
import Spinner from "../../../components/common/Spinner.jsx";
import { delay } from "../utils/delay.js";
import { notify } from "../../../utils/toast.js";
import { getErrorMessage } from "../../../utils/errors.js";

/**
 * Brand tokens — shared with ValidationPreview.jsx so the tab and the modal
 * it opens read as one system. Arbitrary-value inline styles, so this drops
 * in without touching tailwind.config.js.
 */
const BLUE = "#134C8C";
const BLUE_DEEP = "#0C3A6B";
const BLUE_TINT = "#E1EBF7";
const AMBER = "#C97A2B";
const AMBER_DEEP = "#9C5C1E";
const AMBER_TINT = "#F7E7D2";
const RED = "#B23A2E";
const RED_TINT = "#F8E2DF";
const GREEN = "#157F3D";
const GREEN_TINT = "#DFF3E6";
const BORDER = "#D7E1EC";
const INK = "#0E1B2A";
const MUTED = "#516075";
const SURFACE_MUTED = "#F7F9FC";

export default function OfficialDatasetsTab() {
  const fileInputRef = useRef(null);
  const uploadInFlightRef = useRef(false);
  const downloadInFlightRef = useRef(new Set());
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);

  const [datasetName, setDatasetName] = useState("");
  const [coverageStart, setCoverageStart] = useState("");
  const [coverageEnd, setCoverageEnd] = useState("");
  const [coverageVerified, setCoverageVerified] = useState(false);

  const [preview, setPreview] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
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
    if (!coverageStart || !coverageEnd || coverageStart > coverageEnd)
      return false;
    if (!coverageVerified) return false;
    return true;
  }, [file, datasetName, coverageEnd, coverageStart, coverageVerified]);

  const inputKey = JSON.stringify([
    datasetName.trim(),
    coverageStart,
    coverageEnd,
    coverageVerified,
  ]);
  const currentPreview =
    preview?.file === file && preview?.inputKey === inputKey
      ? preview.result
      : null;
  const validateDataset = async () => {
    if (!canValidate || validating || uploading) return;
    setValidating(true);
    setPreview(null);
    setErrorMsg("");
    setStatusMsg("");
    try {
      const result = await upload({
        file,
        name: datasetName.trim(),
            coverageStart,
        coverageEnd,
        coverageVerified,
        preview: true,
      });
      setPreview({ file, inputKey, result });
      setPreviewOpen(true);
    } catch (error) {
      setErrorMsg(getErrorMessage(error, "Validation could not be completed."));
    } finally {
      setValidating(false);
    }
  };

  const resetMessages = () => {
    setErrorMsg("");
    setStatusMsg("");
  };

  const pickFile = () => {
    resetMessages();
    fileInputRef.current?.click();
  };

  const onFileSelected = (f) => {
    if (!f || validating || uploadInFlightRef.current) return;

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

    if (f.size > 25 * 1024 * 1024) {
      setFile(null);
      setErrorMsg("The Excel workbook must not exceed 25 MB.");
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

  const validateAndUpload = async (confirmSkipMissing = false) => {
    if (
      uploadInFlightRef.current ||
      validating ||
      !currentPreview?.canUpload ||
      !canValidate
    )
      return;
    uploadInFlightRef.current = true;
    resetMessages();
    setUploading(true);

    try {
      const result = await notify.promise(
        upload({
          file,
          name: datasetName.trim(),
                coverageStart,
          coverageEnd,
          coverageVerified,
          validationToken: currentPreview.validationToken,
          confirmSkipMissing,
        }),
        {
          success: (res) =>
            res?.formatType
              ? `Imported (${res.formatType}): ${datasetName}`
              : `Uploaded: ${res?.dataset?.name || datasetName}`,
          error: (error) =>
            getErrorMessage(error, "The file could not be processed."),
        },
      );

      if (
        result?.success !== true ||
        !result?.datasetId ||
        !Number.isFinite(result?.insertedRows)
      ) {
        throw new Error(
          "The server did not confirm a successful dataset import.",
        );
      }

      setPreviewOpen(false);
      setStatusMsg(
        `Imported: ${result.formatType} (${result.insertedRows} records)`,
      );
      setFile(null);
      setCoverageStart("");
      setCoverageEnd("");
      setCoverageVerified(false);
      try {
        await fetchRecent();
      } catch (refreshError) {
        notify.error(getErrorMessage(refreshError, "Dataset saved, but the recent uploads list could not refresh. Refresh the list to see it."));
      }
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
      setDownloadingId((current) => (current === datasetId ? "" : current));
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

  const dateInputStyle = {
    borderColor: BORDER,
    colorScheme: "light",
  };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="min-w-0 space-y-6">
        <div
          className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-6"
          style={{ borderColor: BORDER }}
        >
          <div className="mb-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold" style={{ color: INK }}>
                Upload official dataset
              </h2>
              <p className="mt-0.5 text-xs" style={{ color: MUTED }}>
                Add a new CESU case workbook to FoodSafe.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={templateDownloading}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 sm:w-auto"
              style={{ borderColor: BORDER, color: INK }}
            >
              <Download size={16} />
              {templateDownloading
                ? "Preparing template\u2026"
                : "Download template"}
            </button>
          </div>

          <div
            className="mb-5 rounded-lg p-3 text-sm"
            style={{ background: SURFACE_MUTED, border: `1px solid ${BORDER}` }}
          >
            <div
              className="mb-1.5 flex items-center gap-1.5 font-semibold"
              style={{ color: BLUE_DEEP }}
            >
              <FileSpreadsheet size={14} /> Accepted uploads
            </div>
            <ul className="list-disc space-y-1 pl-5 text-xs" style={{ color: MUTED }}>
              <li>
                <span className="font-medium" style={{ color: INK }}>
                  Raw health office XLSX
                </span>
                : multi-sheet, each sheet = disease. Needs "Report date",
                "District", "Case Classification".
              </li>
              <li>
                <span className="font-medium" style={{ color: INK }}>
                  FoodSafe template XLSX
                </span>
                : enter district, barangay, disease, report date,
                classification, and cases. FoodSafe calculates calendar and
                morbidity fields from the CESU report date.
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
            onRemoveFile={() => {
              if (!uploading && !validating) setFile(null);
            }}
          />

          <fieldset
            disabled={uploading || validating}
            className="mt-6 min-w-0 space-y-4"
          >
            {/* Dataset name */}
            <div>
              <label
                className="mb-1.5 flex items-center gap-1 text-sm font-medium"
                style={{ color: INK }}
              >
                Dataset name <span style={{ color: RED }}>*</span>
              </label>
              <input
                required
                type="text"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2"
                style={{ borderColor: BORDER, "--tw-ring-color": BLUE_TINT }}
                placeholder="Q1 2025 Foodborne Disease Data"
              />
            </div>

            {/* Official reporting coverage — interactive input group */}
            <fieldset
              className="min-w-0 rounded-xl border p-4"
              style={{ borderColor: BORDER, borderLeftWidth: 3, borderLeftColor: BLUE }}
            >
              <legend
                className="flex items-center gap-1.5 px-1 text-sm font-semibold"
                style={{ color: INK }}
              >
                <CalendarRange size={15} style={{ color: BLUE }} />
                Official reporting coverage
              </legend>
              <p className="text-xs" style={{ color: MUTED }}>
                The exact period CESU reported for — independent of the
                case rows in the file.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="min-w-0 text-sm" style={{ color: INK }}>
                  Coverage start <span style={{ color: RED }}>*</span>
                  <input
                    required
                    type="date"
                    value={coverageStart}
                    max={coverageEnd || undefined}
                    onChange={(event) => {
                      setCoverageStart(event.target.value);
                      setCoverageVerified(false);
                    }}
                    className="mt-1 min-h-11 min-w-0 w-full rounded-lg border bg-white px-3 py-2.5 text-sm"
                    style={dateInputStyle}
                  />
                </label>
                <label className="min-w-0 text-sm" style={{ color: INK }}>
                  Coverage end <span style={{ color: RED }}>*</span>
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
                    className="mt-1 min-h-11 min-w-0 w-full rounded-lg border bg-white px-3 py-2.5 text-sm"
                    style={dateInputStyle}
                  />
                </label>
              </div>
              {coverageStart && coverageEnd && coverageStart > coverageEnd ? (
                <p className="mt-2 text-xs font-medium" style={{ color: RED }}>
                  Coverage end must be on or after coverage start.
                </p>
              ) : null}

              <details className="mt-2.5 group">
                <summary
                  className="flex w-fit cursor-pointer list-none items-center gap-1 text-xs font-medium"
                  style={{ color: BLUE_DEEP }}
                >
                  <Info size={12} /> How coverage dates affect validation
                </summary>
                <p className="mt-1.5 text-xs leading-relaxed" style={{ color: MUTED }}>
                  Rows outside the selected coverage dates will cause
                  validation to fail. Missing periods inside confirmed
                  coverage are treated as zero; periods outside it remain
                  missing.
                </p>
              </details>
            </fieldset>

            {/* Completeness attestation */}
            <div
              className="rounded-xl p-3.5"
              style={{ background: AMBER_TINT, border: `1px solid ${AMBER}66` }}
            >
              <label
                className="flex items-start gap-3 text-sm"
                style={{ color: AMBER_DEEP }}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0"
                  checked={coverageVerified}
                  onChange={(event) => setCoverageVerified(event.target.checked)}
                />
                <span className="font-medium">
                  I confirm CESU reporting was complete for all six districts
                  during this period.
                </span>
              </label>
              <p className="mt-1.5 pl-7 text-xs" style={{ color: AMBER_DEEP, opacity: 0.85 }}>
                Covered periods without a case row will be encoded as zero,
                not treated as missing.
              </p>
            </div>
          </fieldset>

          <div className="mt-6">
            <button
              onClick={validateDataset}
              disabled={!canValidate || uploading || validating}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed"
              style={
                !canValidate || uploading || validating
                  ? { background: "#E7EAEE", color: "#9AA5B1" }
                  : { background: BLUE, color: "#fff" }
              }
            >
              {(uploading || validating) && (
                <span className="inline-flex h-4 w-4">
                  <Spinner />
                </span>
              )}
              {uploading
                ? "Uploading\u2026"
                : validating
                  ? "Validating\u2026"
                  : "Validate Dataset"}
            </button>
          </div>

          {file && !canValidate && (
            <p className="mt-3 text-sm" style={{ color: MUTED }}>
              Enter the dataset name and confirm coverage dates, then click
              Validate Dataset. Selecting a file does not save it.
            </p>
          )}
          {previewOpen && currentPreview && (
            <ValidationPreview
              result={currentPreview}
              fileName={file?.name}
              uploading={uploading}
              uploadError={errorMsg}
              onConfirm={validateAndUpload}
              onClose={() => {
                if (!uploading) setPreviewOpen(false);
              }}
              onCancel={() => {
                if (!uploading) {
                  setPreviewOpen(false);
                  setPreview(null);
                  setFile(null);
                  resetMessages();
                }
              }}
            />
          )}

          {(errorMsg || statusMsg) && (
            <div
              className="mt-4 flex items-start gap-2 rounded-lg p-3 text-sm"
              style={
                errorMsg
                  ? { background: RED_TINT, color: RED }
                  : { background: GREEN_TINT, color: GREEN }
              }
            >
              {errorMsg ? (
                <XCircle size={16} className="mt-0.5 shrink-0" />
              ) : (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              )}
              <span>{errorMsg || statusMsg}</span>
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