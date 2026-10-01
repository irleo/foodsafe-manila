import XLSX from "xlsx";
import { normalizeTemplateRow, normalizeRawHealthOfficeRow, isBlankRow, normalizeDisease, normalizeDistrict, parseExcelDate } from "./officialCaseNormalizer.js";

const TEMPLATE = ["district", "barangay", "disease", "report_date", "case_classification", "cases"];
const RAW = ["report_date", "district", "case_classification"];
const DETAIL_LIMIT = 5000;
/** @param {unknown} value @returns {string} */
const key = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "_");
/** @typedef {{sheet: string|null, row: number|null, field: string, column?: string|null, message: string}} Issue */

/** Read-only validation. All counts cover the entire workbook; response details are bounded.
 * @param {{fileBuffer: Buffer, declaredCoverageStart?: Date, declaredCoverageEnd?: Date}} options
 */
export function validateOfficialWorkbook({ fileBuffer, declaredCoverageStart, declaredCoverageEnd }) {
  /** @type {Issue[]} */
  const errors = [];
  /** @type {Issue[]} */
  const warnings = [];
  const validRecords = [];
  const worksheets = [];
  const normalized = [];
  let errorCount = 0;
  let warningCount = 0;
  let totalRows = 0;
  let duplicateRows = 0;
  let invalidRows = 0;
  let missingFieldRows = 0;
  const formats = new Set();
  const seen = new Set();
  /** @param {Issue} issue */
  const error = (issue) => { errorCount++; if (errors.length < DETAIL_LIMIT) errors.push(issue); };
  /** @param {Issue} issue */
  const warn = (issue) => { warningCount++; if (warnings.length < DETAIL_LIMIT) warnings.push(issue); };
  const finish = () => ({
    success: errorCount === 0, canUpload: errorCount === 0,
    formatType: formats.size === 1 ? [...formats][0] : "mixed_workbook",
    totalRows, validRowCount: normalized.length, invalidRowCount: invalidRows, duplicateRows, missingFieldRows,
    skippedRows: duplicateRows + missingFieldRows, requiresSkipConfirmation: missingFieldRows > 0,
    errorCount, warningCount, errors, warnings, validRecords, worksheets,
    detailsTruncated: errorCount > errors.length || warningCount > warnings.length || normalized.length > validRecords.length,
    reason: errorCount ? "Fix all blocking errors and validate the corrected workbook." : "Validation passed. Review the preview before confirming upload.",
    normalized,
  });
  let workbook;
  try {
    workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: false, cellNF: true });
  } catch (cause) {
    error({ sheet: null, row: null, field: "workbook", message: "The file could not be read as an Excel workbook." });
    return finish();
  }
  const start = new Date(declaredCoverageStart);
  const end = new Date(declaredCoverageEnd);
  const coverageValid = Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start <= end;
  if (!coverageValid) error({ sheet: null, row: null, field: "coverage", message: "Valid coverage start and end dates are required." });
  for (const sheet of workbook.SheetNames) {
    const ws = workbook.Sheets[sheet];
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    if (range.e.r - range.s.r > 250000 || range.e.c - range.s.c >= 100 || workbook.SheetNames.length > 30) {
      error({ sheet, row: null, field: "workbook", message: "Workbook exceeds supported limits: 30 worksheets, 100 columns and 250,000 rows per worksheet. Split the workbook before retrying." });
      return finish();
    }
    // Excel dates are calendar values, not local-time instants. Build UTC dates
    // from serial components so positive-offset hosts cannot move them back a day.
    for (const [address, cell] of Object.entries(ws)) {
      if (address.startsWith("!") || cell.t !== "n" || !XLSX.SSF.is_date(cell.z || "")) continue;
      const date = XLSX.SSF.parse_date_code(cell.v, { date1904: Boolean(workbook.Workbook?.WBProps?.date1904) });
      if (date) {
        cell.t = "d";
        cell.v = new Date(Date.UTC(date.y, date.m - 1, date.d));
      }
    }
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    const [headers = []] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    const keys = headers.map(key);
    const origin = XLSX.utils.decode_range(ws["!ref"] || "A1").s;
    const headerRow = origin.r + 1;
    if (worksheets.length < 30) worksheets.push({
      name: sheet, headerRow, totalRows: rows.length,
      columns: headers.slice(0, 50).map((label, index) => ({ label: String(label).slice(0, 200), column: XLSX.utils.encode_col(index + origin.c), field: keys[index] })),
      rows: rows.filter((row) => !isBlankRow(row)).slice(0, 100).map((source) => ({
        row: source.__rowNum__ + 1,
        cells: headers.slice(0, 50).map((label) => {
          const value = source[label];
          return value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : String(value ?? "").slice(0, 200);
        }),
      })),
    });
    if (!keys.some(Boolean) && !rows.length) continue;
    const template = keys.includes("cases") || keys.includes("disease") || (!normalizeDisease(sheet) && keys.includes("barangay"));
    const required = template ? TEMPLATE : RAW;
    const relevant = keys.some((v) => required.includes(v));
    if (!relevant) {
      const instructionSheet = /^(instructions?|notes?|readme)$/i.test(sheet.trim());
      (instructionSheet ? warn : error)({ sheet, row: headerRow, field: "worksheet", message: instructionSheet ? "Instruction worksheet will not be imported." : "Unrecognized worksheet. Check the worksheet name and required column headers." });
      continue;
    }
    formats.add(template ? "processed_template" : "raw_health_office");
    for (const field of required) {
      if (!keys.includes(field)) error({ sheet, row: headerRow, field, message: `Missing required column: ${field}. Check the header spelling.` });
    }
    for (const [index, field] of keys.entries()) {
      if (field && keys.indexOf(field) !== index) error({ sheet, row: headerRow, field, column: XLSX.utils.encode_col(index + origin.c), message: "Duplicate column header is ambiguous." });
    }
    for (const source of rows) {
      if (isBlankRow(source)) continue;
      totalRows++;
      if (totalRows > 250000) {
        error({ sheet, row: source.__rowNum__ + 1, field: "workbook", message: "Workbook exceeds the 250,000-record validation limit. Split it into smaller workbooks." });
        return finish();
      }
      const row = source.__rowNum__ + 1;
      const values = Object.fromEntries(Object.entries(source).map(([k, v]) => [key(k), v]));
      const result = template ? normalizeTemplateRow(values) : normalizeRawHealthOfficeRow({ sheetName: sheet, row: {
        "Report date": values.report_date, District: values.district, Barangay: values.barangay, "Case Classification": values.case_classification,
      } });
      const rowIssues = result.ok ? [] : [...(result.errors || [result])];
      if (!template && !normalizeDistrict(values.district) && !rowIssues.some((issue) => issue.field === "district")) {
        rowIssues.push({ field: "district", message: "District is missing or unrecognized. Enter District 1 through District 6." });
      }
      for (const field of required) {
        if (!String(values[field] ?? "").trim() && !rowIssues.some((issue) => ({ reportDate: "report_date", caseClassification: "case_classification" }[issue.field] || issue.field) === field)) {
          rowIssues.push({ field, message: "Required value is missing." });
        }
      }
      for (const [index, field] of keys.entries()) {
        if (ws[XLSX.utils.encode_cell({ r: row - 1, c: index + origin.c })]?.f) {
          rowIssues.push({ field, message: "Formula cells are not accepted. Replace the formula with its verified value." });
        }
      }
      const caseDate = parseExcelDate(values.report_date);
      if (caseDate && coverageValid && (caseDate < start || caseDate > end)) {
        rowIssues.push({ field: "reportDate", message: "Case date falls outside the declared coverage dates." });
      }
      if (rowIssues.length) {
        const missing = new Set(required.filter((field) => !String(values[field] ?? "").trim()));
        const reportedMissing = new Set();
        let hasBlockingIssue = false;
        for (const issue of rowIssues) {
          const field = ({ reportDate: "report_date", caseClassification: "case_classification" })[issue.field] || issue.field;
          const index = keys.indexOf(field);
          const location = { sheet, row, field, column: index >= 0 ? XLSX.utils.encode_col(index + origin.c) : null };
          if (missing.has(field) && !issue.message.startsWith("Formula")) {
            if (!reportedMissing.has(field)) warn({ ...location, code: "missing_field", message: "Required value is missing. This entire row will be skipped and excluded from imported records and case totals." });
            reportedMissing.add(field);
          } else {
            hasBlockingIssue = true;
            error({ ...location, message: issue.message });
          }
        }
        if (hasBlockingIssue) invalidRows++;
        else missingFieldRows++;
        continue;
      }
      const record = result.value;
      // Preserve distinct source records even when their analytical fields match.
      const identity = JSON.stringify([record.disease, Object.entries(values).sort(([a], [b]) => a.localeCompare(b))]);
      if (seen.has(identity)) {
        duplicateRows++;
        warn({ sheet, row, field: "row", message: "Exact duplicate source row; only the first occurrence will be imported." });
        continue;
      }
      seen.add(identity);
      normalized.push(record);
      if (validRecords.length < 100) validRecords.push({ sheet, row, district: record.district, barangay: record.barangay, disease: record.disease, reportDate: record.surveillanceDate.toISOString().slice(0, 10), caseClassification: record.caseClassification, cases: record.cases });
    }
  }
  if (formats.size > 1) error({ sheet: null, row: null, field: "workbook", message: "Use either raw health-office worksheets or processed-template worksheets in one workbook, not both formats." });
  if (!normalized.length && errorCount === 0) error({ sheet: null, row: null, field: "workbook", message: "No valid case records were found." });
  return finish();
}

