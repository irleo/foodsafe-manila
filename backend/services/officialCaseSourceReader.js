import fs from "fs";
import XLSX from "xlsx";

import {
  isBlankRow,
  normalizeRawHealthOfficeRow,
  normalizeTemplateRow,
} from "./officialCaseNormalizer.js";

const CACHE_LIMIT = 4;
const sourceCache = new Map();

function normalizeHeaderKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "_");
}

function normalizeTemplateRowKeys(row = {}) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeHeaderKey(key), value]),
  );
}

function rawSheetHasRequiredHeaders(rows) {
  const headers = new Set(Object.keys(rows[0] || {}).map(normalizeHeaderKey));
  return ["report_date", "district", "case_classification"]
    .every((header) => headers.has(header));
}

function detectWorkbookFormat(workbook) {
  for (const sheetName of workbook?.SheetNames || []) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
    if (!rows.length) continue;
    const headers = new Set(Object.keys(rows[0] || {}).map(normalizeHeaderKey));
    if (["city", "district", "barangay", "disease", "year", "month", "case_classification", "cases"]
      .every((header) => headers.has(header))) {
      return { ok: true, formatType: "processed_template", sheetName };
    }
  }
  for (const sheetName of workbook?.SheetNames || []) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
    if (rows.length && rawSheetHasRequiredHeaders(rows)) {
      return { ok: true, formatType: "raw_health_office" };
    }
  }
  return { ok: false, reason: "Stored upload is not a supported official-case workbook." };
}

function readNormalizedRows(dataset) {
  if (!dataset?.filePath || !fs.existsSync(dataset.filePath)) {
    throw new Error("The original dataset file is unavailable for weekly compatibility processing.");
  }
  const workbook = XLSX.readFile(dataset.filePath);
  const detected = detectWorkbookFormat(workbook);
  if (!detected.ok) throw new Error(detected.reason);

  const normalized = [];
  if (detected.formatType === "raw_health_office") {
    for (const sheetName of workbook.SheetNames || []) {
      const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
      if (!sheetRows.length || !rawSheetHasRequiredHeaders(sheetRows)) continue;
      for (const row of sheetRows) {
        if (isBlankRow(row)) continue;
        const result = normalizeRawHealthOfficeRow({ sheetName, row });
        if (result.ok) normalized.push(result.value);
      }
    }
  } else {
    const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[detected.sheetName], { defval: "" });
    for (const row of sheetRows) {
      if (isBlankRow(row)) continue;
      const result = normalizeTemplateRow(normalizeTemplateRowKeys(row));
      if (result.ok && result.value.epidemiologicalWeek) normalized.push(result.value);
    }
  }
  if (!normalized.length) {
    throw new Error("The original dataset file contains no valid weekly records.");
  }
  return normalized;
}

function buildDistrictCoverage(rows) {
  const ranges = new Map();
  for (const row of rows) {
    const date = row.surveillanceDate || row.weekStartDate;
    const timestamp = date instanceof Date ? date.getTime() : new Date(date).getTime();
    if (!row.district || !Number.isFinite(timestamp)) continue;
    const current = ranges.get(row.district) || { start: timestamp, end: timestamp };
    current.start = Math.min(current.start, timestamp);
    current.end = Math.max(current.end, timestamp);
    ranges.set(row.district, current);
  }
  return new Map([...ranges].map(([district, range]) => [district, {
    district,
    coverageStart: new Date(range.start),
    coverageEnd: new Date(range.end),
    verifiedComplete: true,
    verificationSource: "legacy_source_observed_range",
  }]));
}

function cacheKey(dataset, stat) {
  return `${dataset._id}:${stat.mtimeMs}:${stat.size}`;
}

/**
 * Re-reads an immutable stored upload when legacy database rows lack morbidity-week fields.
 * Dates and district ranges come only from the source workbook; no dates are inferred from a month.
 */
export function loadOfficialCaseSource(dataset) {
  if (!dataset?.filePath || !fs.existsSync(dataset.filePath)) return null;
  const stat = fs.statSync(dataset.filePath);
  const key = cacheKey(dataset, stat);
  if (sourceCache.has(key)) return sourceCache.get(key);

  const rows = readNormalizedRows(dataset);
  const value = {
    rows,
    districtCoverage: buildDistrictCoverage(rows),
    source: "stored_original_upload",
  };
  sourceCache.set(key, value);
  while (sourceCache.size > CACHE_LIMIT) {
    sourceCache.delete(sourceCache.keys().next().value);
  }
  return value;
}
