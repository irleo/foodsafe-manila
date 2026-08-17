import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import csv from "csv-parser";

import Dataset from "../models/Dataset.js";
import OfficialCase from "../models/OfficialCase.js";
import { refreshDashboardSummaryAfterWrite } from "./dashboardSummaryService.js";
import {
  isBlankRow,
  normalizeRawHealthOfficeRow,
  normalizeTemplateRow,
} from "./officialCaseNormalizer.js";

const TEMPLATE_REQUIRED = [
  "city",
  "district",
  "barangay",
  "disease",
  "year",
  "month",
  "case_classification",
  "cases",
];

const RAW_REQUIRED = ["Report date", "District", "Case Classification"];

function normalizeHeaderKey(k) {
  return String(k || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function hasAllHeaders(headers = [], required = []) {
  const set = new Set(headers.map(normalizeHeaderKey));
  return required.every((r) => set.has(normalizeHeaderKey(r)));
}

export function detectOfficialCaseXlsxFormat(wb) {
  const sheetNames = wb?.SheetNames || [];
  if (!sheetNames.length)
    return { ok: false, reason: "Workbook has no sheets." };

  // Template: find any sheet containing all required template columns
  for (const sn of sheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: "" });
    if (!rows.length) continue;
    const headers = Object.keys(rows[0] || {});
    if (hasAllHeaders(headers, TEMPLATE_REQUIRED)) {
      return { ok: true, formatType: "processed_template", sheetName: sn };
    }
  }

  // Raw: any sheet containing raw required columns
  for (const sn of sheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: "" });
    if (!rows.length) continue;
    const headers = Object.keys(rows[0] || {});
    if (hasAllHeaders(headers, RAW_REQUIRED)) {
      return { ok: true, formatType: "raw_health_office" };
    }
  }

  return {
    ok: false,
    reason:
      "Uploaded file does not match the raw health office format or the OfficialCaseTemplate format.",
  };
}

function validateRawWorkbook(wb) {
  const errors = [];
  let validSheets = 0;
  let totalRows = 0;

  for (const sn of wb.SheetNames || []) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: "" });
    if (!rows.length) continue;
    totalRows += rows.length;
    const headers = Object.keys(rows[0] || {});
    if (!hasAllHeaders(headers, RAW_REQUIRED)) continue;
    validSheets += 1;
  }

  if (!validSheets) {
    errors.push({
      sheet: null,
      row: null,
      field: "workbook",
      message: `No valid raw sheets found. Required columns: ${RAW_REQUIRED.join(", ")}`,
    });
  }

  return { ok: errors.length === 0, errors, totalRows, validSheets };
}

function validateTemplateWorkbook(wb, preferredSheetName) {
  const errors = [];
  const sheetName =
    (preferredSheetName && wb.SheetNames.includes(preferredSheetName)
      ? preferredSheetName
      : wb.SheetNames.find((sn) => {
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: "" });
          const headers = Object.keys(rows[0] || {});
          return rows.length && hasAllHeaders(headers, TEMPLATE_REQUIRED);
        })) || null;

  if (!sheetName) {
    return {
      ok: false,
      sheetName: null,
      errors: [
        {
          sheet: null,
          row: null,
          field: "workbook",
          message: `No sheet found with required columns: ${TEMPLATE_REQUIRED.join(", ")}`,
        },
      ],
      totalRows: 0,
    };
  }

  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
  return { ok: errors.length === 0, sheetName, errors, totalRows: rows.length };
}

function minMaxYearMonth(records) {
  let coverageStart = null;
  let coverageEnd = null;
  for (const r of records) {
    const weeklyStart = r.weekStartDate ? new Date(r.weekStartDate) : null;
    const rowStart = weeklyStart && !Number.isNaN(weeklyStart.getTime())
      ? weeklyStart
      : new Date(Date.UTC(r.year, r.month - 1, 1));
    const rowEnd = weeklyStart && !Number.isNaN(weeklyStart.getTime())
      ? new Date(rowStart.getTime() + (6 * 86400000))
      : new Date(Date.UTC(r.year, r.month, 0));
    if (!coverageStart || rowStart < coverageStart) coverageStart = rowStart;
    if (!coverageEnd || rowEnd > coverageEnd) coverageEnd = rowEnd;
  }
  if (!coverageStart || !coverageEnd)
    return { coverageStart: null, coverageEnd: null };
  return { coverageStart, coverageEnd };
}

async function parseCsvRows(filePath) {
  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => rows.push(row))
      .on("end", resolve)
      .on("error", reject);
  });
  return rows;
}

function normalizeTemplateCsvRowKeys(row = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(row || {})) {
    const k = String(key || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    normalized[k] = value;
  }
  return normalized;
}

function validateCesuCoverage(records, providerType) {
  if (providerType !== "cesu") return null;
  return records.some((record) => Number(record.year) < 2022)
    ? "CESU surveillance data in this project begins in 2022. Records before 2022 cannot be labeled as CESU data."
    : null;
}

/**
 * Imports official case XLSX (raw health office or processed template) into OfficialCase (monthly).
 *
 * @returns {Promise<{success:boolean, formatType?:string, datasetId?:string, insertedRows?:number, skippedRows?:number, coverageStart?:string, coverageEnd?:string, diseases?:string[], districts?:string[], validationErrors?:any, reason?:string }>}
 */
export async function importOfficialCasesXlsx({
  filePath,
  name,
  originalFileName,
  storedFileName,
  mimeType,
  userId,
  providerType = "cesu",
  providerName = "CESU",
  reportingFrequency = "weekly",
} = {}) {
  if (!filePath) throw new Error("filePath is required");

  const wb = XLSX.readFile(filePath);
  const detected = detectOfficialCaseXlsxFormat(wb);
  if (!detected.ok) {
    return { success: false, reason: detected.reason, validationErrors: [] };
  }

  const formatType = detected.formatType;

  if (formatType === "raw_health_office") {
    const v = validateRawWorkbook(wb);
    if (!v.ok) {
      return {
        success: false,
        formatType,
        reason: "Validation failed",
        validationErrors: v.errors,
      };
    }

    const normalized = [];
    const validationErrors = [];
    const diseases = new Set();
    const districts = new Set();

    for (const sn of wb.SheetNames || []) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: "" });
      if (!rows.length) continue;
      const headers = Object.keys(rows[0] || {});
      if (!hasAllHeaders(headers, RAW_REQUIRED)) continue;

      diseases.add(String(sn).trim());
      for (let i = 0; i < rows.length; i++) {
        const rowNum = i + 2;
        const row = rows[i];
        if (isBlankRow(row)) continue;
        const n = normalizeRawHealthOfficeRow({ sheetName: sn, row });
        if (!n.ok) {
          validationErrors.push({
            sheet: sn,
            row: rowNum,
            field: n.field,
            message: n.message,
          });
          continue;
        }
        districts.add(n.value.district);
        normalized.push(n.value);
      }
    }

    if (!normalized.length) {
      return {
        success: false,
        formatType,
        reason: "No valid rows could be normalized.",
        validationErrors,
      };
    }

    const cesuCoverageError = validateCesuCoverage(normalized, providerType);
    if (cesuCoverageError) return { success: false, formatType, reason: cesuCoverageError, validationErrors };
    const { coverageStart, coverageEnd } = minMaxYearMonth(normalized);

    const dataset = await Dataset.create({
      name:
        name?.trim() ||
        path.basename(
          originalFileName || storedFileName || "official_cases.xlsx",
        ),
      dataSource: providerName,
      providerType,
      providerName,
      reportingFrequency,
      ingestionMethod: "excel",
      coverageStart,
      coverageEnd,
      originalFileName: originalFileName || "official_cases.xlsx",
      storedFileName: storedFileName || path.basename(filePath),
      filePath,
      mimeType:
        mimeType ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      status: "pending",
      uploadedBy: userId || null,
      formatType,
      diseases: Array.from(diseases),
      districts: Array.from(districts),
      totalRows: v.totalRows,
      insertedRows: 0,
      skippedRows: validationErrors.length,
      validationErrors: validationErrors.length ? validationErrors : null,
    });

    // Insert monthly aggregate documents: group identical keys and sum cases (raw rows default to 1)
    const byKey = new Map();
    for (const r of normalized) {
      const key = [
        r.city,
        r.district,
        r.barangayNo,
        r.disease,
        r.year,
        r.month,
        r.epidemiologicalYear,
        r.epidemiologicalWeek,
        r.caseClassification,
        r.source,
      ].join("|");
      const prev = byKey.get(key);
      byKey.set(key, {
        ...r,
        cases: (prev?.cases || 0) + Number(r.cases || 0),
      });
    }
    const docs = Array.from(byKey.values()).map((r) => ({
      ...r,
      datasetId: dataset._id,
      providerType,
      providerName,
      reportingFrequency,
    }));

    await OfficialCase.deleteMany({ datasetId: dataset._id });
    await OfficialCase.insertMany(docs, { ordered: false });

    dataset.insertedRows = docs.length;
    dataset.recordsCount = docs.length;
    dataset.totalRows = v.totalRows;
    dataset.skippedRows = validationErrors.length;
    dataset.status = "validated";
    await dataset.save();
    await refreshDashboardSummaryAfterWrite();

    return {
      success: true,
      formatType,
      datasetId: String(dataset._id),
      insertedRows: docs.length,
      skippedRows: validationErrors.length,
      coverageStart: dataset.coverageStart.toISOString(),
      coverageEnd: dataset.coverageEnd.toISOString(),
      diseases: dataset.diseases,
      districts: dataset.districts,
      validationErrors: dataset.validationErrors,
    };
  }

  if (formatType === "processed_template") {
    const v = validateTemplateWorkbook(wb, "processed data");
    if (!v.ok) {
      return {
        success: false,
        formatType,
        reason: "Validation failed",
        validationErrors: v.errors,
      };
    }

    const rows = XLSX.utils.sheet_to_json(wb.Sheets[v.sheetName], {
      defval: "",
    });
    const normalized = [];
    const validationErrors = [];
    const diseases = new Set();
    const districts = new Set();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];
      // Skip "notes" / empty trailing columns rows
      if (isBlankRow(row)) continue;

      const n = normalizeTemplateRow(row);
      if (!n.ok) {
        validationErrors.push({
          sheet: v.sheetName,
          row: rowNum,
          field: n.field,
          message: n.message,
        });
        continue;
      }
      diseases.add(n.value.disease);
      districts.add(n.value.district);
      normalized.push(n.value);
    }

    if (!normalized.length) {
      return {
        success: false,
        formatType,
        reason: "No valid rows could be imported.",
        validationErrors,
      };
    }

    const cesuCoverageError = validateCesuCoverage(normalized, providerType);
    if (cesuCoverageError) return { success: false, formatType, reason: cesuCoverageError, validationErrors };
    const { coverageStart, coverageEnd } = minMaxYearMonth(normalized);

    if (reportingFrequency === "weekly" && normalized.some((row) => !row.epidemiologicalWeek)) {
      return {
        success: false,
        formatType,
        reason: "Weekly datasets require epidemiological_week or a report date for every row.",
        validationErrors,
      };
    }

    const dataset = await Dataset.create({
      name:
        name?.trim() ||
        path.basename(
          originalFileName || storedFileName || "cleaned_official_cases.xlsx",
        ),
      dataSource: providerName,
      providerType,
      providerName,
      reportingFrequency,
      ingestionMethod: "excel",
      coverageStart,
      coverageEnd,
      originalFileName: originalFileName || "cleaned_official_cases.xlsx",
      storedFileName: storedFileName || path.basename(filePath),
      filePath,
      mimeType:
        mimeType ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      status: "pending",
      uploadedBy: userId || null,
      formatType,
      diseases: Array.from(diseases),
      districts: Array.from(districts),
      totalRows: rows.length,
      insertedRows: 0,
      skippedRows: validationErrors.length,
      validationErrors: validationErrors.length ? validationErrors : null,
    });

    // Upsert-like behavior within the dataset: group identical keys and sum cases
    const byKey = new Map();
    for (const r of normalized) {
      const key = [
        r.city,
        r.district,
        r.barangayNo,
        r.disease,
        r.year,
        r.month,
        r.epidemiologicalYear,
        r.epidemiologicalWeek,
        r.caseClassification,
        r.source,
      ].join("|");
      const prev = byKey.get(key);
      byKey.set(key, {
        ...r,
        cases: (prev?.cases || 0) + Number(r.cases || 0),
      });
    }
    const docs = Array.from(byKey.values()).map((r) => ({
      ...r,
      datasetId: dataset._id,
      providerType,
      providerName,
      reportingFrequency,
    }));

    await OfficialCase.deleteMany({ datasetId: dataset._id });
    await OfficialCase.insertMany(docs, { ordered: false });

    dataset.insertedRows = docs.length;
    dataset.recordsCount = docs.length;
    dataset.totalRows = rows.length;
    dataset.skippedRows = validationErrors.length;
    dataset.status = "validated";
    await dataset.save();
    await refreshDashboardSummaryAfterWrite();

    return {
      success: true,
      formatType,
      datasetId: String(dataset._id),
      insertedRows: docs.length,
      skippedRows: validationErrors.length,
      coverageStart: dataset.coverageStart.toISOString(),
      coverageEnd: dataset.coverageEnd.toISOString(),
      diseases: dataset.diseases,
      districts: dataset.districts,
      validationErrors: dataset.validationErrors,
    };
  }

  return { success: false, reason: "Unsupported format type." };
}

/**
 * Imports official case CSV that matches OfficialCaseTemplate columns.
 */
export async function importOfficialCasesCsv({
  filePath,
  name,
  originalFileName,
  storedFileName,
  mimeType,
  userId,
  providerType = "cesu",
  providerName = "CESU",
  reportingFrequency = "weekly",
} = {}) {
  if (!filePath) throw new Error("filePath is required");

  const rows = await parseCsvRows(filePath);
  const requiredColumns = [
    "city",
    "district",
    "barangay",
    "disease",
    "year",
    "month",
    "case_classification",
    "cases",
  ];

  if (!rows.length) {
    return {
      success: false,
      formatType: "processed_template_csv",
      reason: "CSV file is empty.",
      validationErrors: [],
    };
  }

  const normalizedRows = rows.map(normalizeTemplateCsvRowKeys);
  const headerSet = new Set(Object.keys(normalizedRows[0] || {}));
  const missingColumns = requiredColumns.filter((c) => !headerSet.has(c));
  if (missingColumns.length) {
    return {
      success: false,
      formatType: "processed_template_csv",
      reason: `Missing required columns: ${missingColumns.join(", ")}`,
      validationErrors: [
        {
          sheet: "csv",
          row: 1,
          field: "headers",
          message: `CSV must match OfficialCaseTemplate columns. Missing: ${missingColumns.join(", ")}`,
        },
      ],
    };
  }

  const normalized = [];
  const validationErrors = [];
  const diseases = new Set();
  const districts = new Set();

  for (let i = 0; i < normalizedRows.length; i++) {
    const rowNum = i + 2; // header row is 1
    const n = normalizeTemplateRow(normalizedRows[i]);
    if (!n.ok) {
      validationErrors.push({
        sheet: "csv",
        row: rowNum,
        field: n.field,
        message: n.message,
      });
      continue;
    }
    diseases.add(n.value.disease);
    districts.add(n.value.district);
    normalized.push(n.value);
  }

  if (!normalized.length) {
    return {
      success: false,
      formatType: "processed_template_csv",
      reason: "No valid rows could be imported.",
      validationErrors,
    };
  }

  const cesuCoverageError = validateCesuCoverage(normalized, providerType);
  if (cesuCoverageError) {
    return { success: false, formatType: "processed_template_csv", reason: cesuCoverageError, validationErrors };
  }
  const { coverageStart, coverageEnd } = minMaxYearMonth(normalized);

  if (reportingFrequency === "weekly" && normalized.some((row) => !row.epidemiologicalWeek)) {
    return {
      success: false,
      formatType: "processed_template_csv",
      reason: "Weekly datasets require epidemiological_week for every row.",
      validationErrors,
    };
  }

  const dataset = await Dataset.create({
    name:
      name?.trim() ||
      path.basename(
        originalFileName || storedFileName || "cleaned_official_cases.csv",
      ),
    dataSource: providerName,
    providerType,
    providerName,
    reportingFrequency,
    ingestionMethod: "csv",
    coverageStart,
    coverageEnd,
    originalFileName: originalFileName || "cleaned_official_cases.csv",
    storedFileName: storedFileName || path.basename(filePath),
    filePath,
    mimeType: mimeType || "text/csv",
    status: "pending",
    uploadedBy: userId || null,
    formatType: "processed_template_csv",
    diseases: Array.from(diseases),
    districts: Array.from(districts),
    totalRows: normalizedRows.length,
    insertedRows: 0,
    skippedRows: validationErrors.length,
    validationErrors: validationErrors.length ? validationErrors : null,
  });

  const byKey = new Map();
  for (const r of normalized) {
    const key = [
      r.city,
      r.district,
      r.barangayNo,
      r.disease,
      r.year,
      r.month,
      r.epidemiologicalYear,
      r.epidemiologicalWeek,
      r.caseClassification,
      r.source,
    ].join("|");
    const prev = byKey.get(key);
    byKey.set(key, {
      ...r,
      cases: (prev?.cases || 0) + Number(r.cases || 0),
    });
  }
  const docs = Array.from(byKey.values()).map((r) => ({
    ...r,
    datasetId: dataset._id,
    providerType,
    providerName,
    reportingFrequency,
  }));

  await OfficialCase.deleteMany({ datasetId: dataset._id });
  await OfficialCase.insertMany(docs, { ordered: false });

  dataset.insertedRows = docs.length;
  dataset.recordsCount = docs.length;
  dataset.totalRows = normalizedRows.length;
  dataset.skippedRows = validationErrors.length;
  dataset.status = "validated";
  await dataset.save();
  await refreshDashboardSummaryAfterWrite();

  return {
    success: true,
    formatType: "processed_template_csv",
    datasetId: String(dataset._id),
    insertedRows: docs.length,
    skippedRows: validationErrors.length,
    coverageStart: dataset.coverageStart.toISOString(),
    coverageEnd: dataset.coverageEnd.toISOString(),
    diseases: dataset.diseases,
    districts: dataset.districts,
    validationErrors: dataset.validationErrors,
  };
}
