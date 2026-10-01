import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  TriangleAlert,
  CircleCheck,
  UploadCloud,
  Loader2,
} from "lucide-react";

/**
 * Brand tokens — same palette used across the FoodSafe Manila dashboard,
 * heatmap, and analytics screens. Kept local so this file drops in without
 * needing a Tailwind config change (all colors are arbitrary-value classes).
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

const TABS = [
  { id: "errors", label: "Errors", icon: CircleAlert, tone: RED },
  { id: "warnings", label: "Warnings", icon: TriangleAlert, tone: AMBER_DEEP },
  { id: "valid", label: "Valid", icon: CircleCheck, tone: GREEN },
];

export default function ValidationPreview({
  result,
  fileName,
  uploading,
  uploadError,
  onConfirm,
  onClose,
  onCancel,
}) {
  const dialog = useRef(null);
  const [skipConfirmed, setSkipConfirmed] = useState(false);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [workbookPage, setWorkbookPage] = useState(0);
  const sheet = result.worksheets?.[sheetIndex];
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, []);
  const handleKeyDown = (event) => {
    if (event.key === "Escape" && !uploading) onClose();
    if (event.key !== "Tab") return;
    const controls = [
      ...dialog.current.querySelectorAll(
        'button:not(:disabled), select:not(:disabled), [tabindex="0"]',
      ),
    ];
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === dialog.current)
    ) {
      event.preventDefault();
      last?.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last ||
        document.activeElement === dialog.current)
    ) {
      event.preventDefault();
      first?.focus();
    }
  };
  const [tab, setTab] = useState("errors");
  const [page, setPage] = useState(0);
  const rows = tab === "valid" ? result.validRecords : result[tab];
  const visible = rows.slice(page * 20, (page + 1) * 20);
  const workbookIssues = (result.errors || []).filter((issue) =>
    ["workbook", "worksheet", "upload"].includes(issue.field) ||
    result.worksheets?.some((worksheet) =>
      worksheet.name === issue.sheet && issue.row === worksheet.headerRow,
    ),
  );
  const workbookRejected = !result.canUpload && workbookIssues.length > 0;
  const rejectionReasons = [...new Set(workbookIssues.map((issue) =>
    `${issue.sheet ? `${issue.sheet}: ` : ""}${issue.message}`,
  ))];


  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-2 sm:p-6"
      style={{ background: "rgba(14,27,42,0.55)" }}
    >
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="validation-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="flex max-h-[95dvh] w-full max-w-6xl flex-col rounded-2xl bg-white shadow-2xl outline-none"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-3 border-b p-4 sm:p-5"
          style={{ borderColor: BORDER }}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ background: BLUE_TINT }}
            >
              <FileSpreadsheet size={18} style={{ color: BLUE_DEEP }} />
            </div>
            <div className="min-w-0">
              <h3
                id="validation-title"
                className="text-base font-bold sm:text-lg"
                style={{ color: INK }}
              >
                Workbook validation preview
              </h3>
              <p className="break-all text-sm" style={{ color: MUTED }}>
                {fileName}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={uploading}
            onClick={onClose}
            aria-label="Close preview"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:opacity-40"
            style={{ borderColor: BORDER, color: MUTED }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
          {/* Status banner */}
          <div
            className="rounded-lg p-3 text-sm"
            style={
              result.canUpload
                ? { background: BLUE_TINT, color: BLUE_DEEP }
                : { background: AMBER_TINT, color: AMBER_DEEP }
            }
          >
            {workbookRejected ? (
              <div role="alert">
                {rejectionReasons.map((reason) => <p key={reason} className="font-semibold">{reason}</p>)}
              </div>
            ) : <span className="font-semibold">{result.reason}</span>}
            <p>Nothing has been saved yet.</p>
          </div>

          {!workbookRejected && <>
          {sheet && (
            <div className="mt-4">
              <label
                className="text-sm font-medium"
                style={{ color: INK }}
              >
                Worksheet
                <select
                  className="ml-2 max-w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: BORDER }}
                  value={sheetIndex}
                  onChange={(event) => {
                    setSheetIndex(Number(event.target.value));
                    setWorkbookPage(0);
                  }}
                >
                  {result.worksheets.map((item, index) => (
                    <option key={item.name} value={index}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="my-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs" style={{ color: MUTED }}>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: RED_TINT, border: `1px solid ${RED}` }} />
                  Cell has an error
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: AMBER_TINT, border: `1px solid ${AMBER}` }} />
                  Row has a warning
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: GREEN_TINT, border: `1px solid ${GREEN}` }} />
                  Passed validation
                </span>
              </div>
              <p className="mb-2 text-xs" style={{ color: MUTED }}>
                Hover or focus an issue cell for its explanation. Preview
                shows up to 30 worksheets, 100 rows per worksheet, and 50
                columns. All case rows are validated.
              </p>

              <div
                className="max-h-72 overflow-auto rounded-lg border"
                style={{ borderColor: BORDER }}
              >
                <table className="min-w-full border-collapse text-left text-xs">
                  <thead
                    className="sticky top-0"
                    style={{ background: BLUE_TINT }}
                  >
                    <tr>
                      <th
                        className="border p-2 font-semibold"
                        style={{ borderColor: BORDER, color: BLUE_DEEP }}
                      >
                        Row
                      </th>
                      {sheet.columns.map((column, index) => (
                        <th
                          className="whitespace-nowrap border p-2 font-semibold"
                          style={{ borderColor: BORDER, color: BLUE_DEEP }}
                          key={index}
                        >
                          {column.column}: {column.label || "(blank header)"}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.rows
                      .slice(workbookPage * 20, (workbookPage + 1) * 20)
                      .map((row) => {
                        const errors = result.errors.filter(
                          (issue) =>
                            issue.sheet === sheet.name &&
                            (issue.row === row.row ||
                              issue.row === sheet.headerRow),
                        );
                        const warnings = result.warnings.filter(
                          (issue) =>
                            issue.sheet === sheet.name && issue.row === row.row,
                        );
                        return (
                          <tr key={row.row}>
                            <th
                              className="border p-2 font-medium"
                              style={{ borderColor: BORDER, background: "#F7F9FC", color: MUTED }}
                            >
                              {row.row}
                            </th>
                            {row.cells.map((value, index) => {
                              const issues = errors.filter(
                                (issue) =>
                                  !issue.column ||
                                  issue.column === sheet.columns[index].column,
                              );
                              const text =
                                issues
                                  .map((issue) => issue.message)
                                  .join(" ") ||
                                warnings
                                  .map((issue) => issue.message)
                                  .join(" ");
                              const cellStyle = issues.length
                                ? { background: RED_TINT, color: RED }
                                : warnings.length
                                  ? { background: AMBER_TINT, color: AMBER_DEEP }
                                  : !errors.length
                                    ? { background: GREEN_TINT }
                                    : {};
                              return (
                                <td
                                  key={index}
                                  tabIndex={text ? 0 : undefined}
                                  title={text || "Passed validation"}
                                  aria-label={
                                    text
                                      ? `${value || "Blank"}: ${text}`
                                      : undefined
                                  }
                                  className="max-w-60 break-words border p-2"
                                  style={{ borderColor: BORDER, ...cellStyle }}
                                >
                                  {value || "(blank)"}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              {sheet.rows.length > 20 && (
                <div className="mt-2.5 flex items-center gap-3 text-sm">
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                    style={{ borderColor: BORDER, color: INK }}
                    disabled={!workbookPage}
                    onClick={() => setWorkbookPage(workbookPage - 1)}
                  >
                    <ChevronLeft size={13} /> Previous rows
                  </button>
                  <span className="text-xs" style={{ color: MUTED }}>
                    {workbookPage + 1} / {Math.ceil(sheet.rows.length / 20)}
                  </span>
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                    style={{ borderColor: BORDER, color: INK }}
                    disabled={(workbookPage + 1) * 20 >= sheet.rows.length}
                    onClick={() => setWorkbookPage(workbookPage + 1)}
                  >
                    Next rows <ChevronRight size={13} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
          <div className="my-4 flex flex-wrap gap-2">
            {TABS.map((option) => {
              const { id, label, icon: Icon, tone } = option;
              const count = { errors: result.errorCount, warnings: result.warningCount, valid: result.validRowCount }[id];
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setTab(id);
                    setPage(0);
                  }}
                  aria-pressed={active}
                  className="flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors"
                  style={
                    active
                      ? { background: BLUE_DEEP, borderColor: BLUE_DEEP, color: "#fff" }
                      : { borderColor: BORDER, color: INK }
                  }
                >
                  <Icon size={14} style={{ color: active ? "#fff" : tone }} />
                  {label}: {count}
                </button>
              );
            })}
          </div>

          {result.detailsTruncated && (
            <p
              className="mb-3 rounded-lg p-2.5 text-sm"
              style={{ background: AMBER_TINT, color: AMBER_DEEP }}
            >
              Counts cover the entire workbook. Details show up to 5,000
              errors/warnings and 100 valid records. Correct listed errors and
              validate again to see any remaining issues.
            </p>
          )}

          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: BORDER }}>
            <table className="w-full text-left text-sm">
              <thead style={{ background: "#F7F9FC" }}>
                <tr>
                  {[
                    "Worksheet",
                    "Excel row",
                    tab === "valid" ? "Validated fields" : "Field / column",
                    "Result",
                  ].map((label) => (
                    <th
                      key={label}
                      className="border-b p-2.5 text-xs font-semibold uppercase tracking-wide"
                      style={{ borderColor: BORDER, color: MUTED }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((entry, index) => (
                  <tr key={`${entry.sheet}-${entry.row}-${index}`}>
                    <td className="border-b p-2.5" style={{ borderColor: BORDER }}>
                      {entry.sheet || "Workbook"}
                    </td>
                    <td className="border-b p-2.5" style={{ borderColor: BORDER, color: MUTED }}>
                      {entry.row || "\u2014"}
                    </td>
                    <td className="border-b p-2.5" style={{ borderColor: BORDER }}>
                      {tab === "valid"
                        ? `${entry.district}, ${entry.barangay || "No barangay"}, ${entry.disease}`
                        : `${entry.field}${entry.column ? ` (${entry.column}${entry.row || ""})` : ""}`}
                    </td>
                    <td className="border-b p-2.5" style={{ borderColor: BORDER }}>
                      {tab === "valid"
                        ? `${entry.reportDate}; ${entry.caseClassification}; ${entry.cases} case(s)`
                        : entry.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <p className="p-3 text-sm" style={{ color: MUTED }}>
                No {tab} to display.
              </p>
            )}
          </div>
          {rows.length > 20 && (
            <div className="mt-3 flex items-center gap-3 text-sm">
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                style={{ borderColor: BORDER, color: INK }}
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft size={13} /> Previous
              </button>
              <span className="text-xs" style={{ color: MUTED }}>
                Page {page + 1} of {Math.ceil(rows.length / 20)}
              </span>
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                style={{ borderColor: BORDER, color: INK }}
                disabled={(page + 1) * 20 >= rows.length}
                onClick={() => setPage(page + 1)}
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          )}
          </>}
        </div>

        {uploadError && (
          <p role="alert" className="px-4 py-2 text-sm sm:px-5" style={{ color: RED }}>
            {uploadError}
          </p>
        )}

        {/* Footer */}
        <div
          className="flex flex-wrap items-center justify-end gap-3 border-t p-4 sm:p-5"
          style={{ borderColor: BORDER }}
        >
          {result.canUpload && result.requiresSkipConfirmation && (
            <label className="w-full rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <input type="checkbox" checked={skipConfirmed} disabled={uploading} onChange={(event) => setSkipConfirmed(event.target.checked)} className="mr-2" />
              I confirm: import {result.validRowCount} valid source rows and skip {result.missingFieldRows} incomplete rows{result.duplicateRows ? ` plus ${result.duplicateRows} duplicate rows` : ""}. Skipped rows will not count toward imported records or case totals.
            </label>
          )}
          {!result.canUpload && !workbookRejected && (
            <p className="mr-auto text-sm" style={{ color: RED }}>
              Fix blocking errors in the source workbook, then select and
              validate the corrected file.
            </p>
          )}
          <button
            type="button"
            disabled={uploading}
            onClick={onCancel}
            className="rounded-lg border px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
            style={{ borderColor: BORDER, color: INK }}
          >
            Cancel
          </button>
          {!workbookRejected && <button
            type="button"
            disabled={uploading || !result.canUpload || !result.validationToken || (result.requiresSkipConfirmation && !skipConfirmed)}
            onClick={() => onConfirm(skipConfirmed)}
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: BLUE }}
          >
            {uploading ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Saving dataset…
              </>
            ) : (
              <>
                <UploadCloud size={15} /> Proceed with Upload
              </>
            )}
          </button>}
        </div>
      </section>
    </div>,
    document.body,
  );
}
