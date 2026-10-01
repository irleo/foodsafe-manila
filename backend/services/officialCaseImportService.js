import { validateWorkbookIsolated } from "./validateWorkbookIsolated.js";
import path from "path";
import XLSX from "xlsx";
import mongoose from "mongoose";

import Dataset from "../models/Dataset.js";
import OfficialCase from "../models/OfficialCase.js";
import { refreshDashboardSummaryAfterWrite } from "./dashboardSummaryService.js";

const TEMPLATE_REQUIRED = [
  "district",
  "barangay",
  "disease",
  "report_date",
  "case_classification",
  "cases",
];

const RAW_REQUIRED = ["Report date", "District", "Case Classification"];

function normalizeHeaderKey(k) {
  return String(k || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "_");
}

function hasAllHeaders(headers = [], required = []) {
  const set = new Set(headers.map(normalizeHeaderKey));
  return required.every((r) => set.has(normalizeHeaderKey(r)));
}

function worksheetHeaders(sheet) {
  const [headerRow = []] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  });
  return Array.isArray(headerRow) ? headerRow : [];
}

export function detectOfficialCaseXlsxFormat(wb) {
  const sheetNames = wb?.SheetNames || [];
  if (!sheetNames.length)
    return { ok: false, reason: "Workbook has no sheets." };

  // Template: find any sheet containing all required template columns
  for (const sn of sheetNames) {
    const headers = worksheetHeaders(wb.Sheets[sn]);
    if (hasAllHeaders(headers, TEMPLATE_REQUIRED)) {
      return { ok: true, formatType: "processed_template", sheetName: sn };
    }
  }

  // Raw: any sheet containing raw required columns
  for (const sn of sheetNames) {
    const headers = worksheetHeaders(wb.Sheets[sn]);
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

export function districtCoverageFromRecords(records, suppliedCoverage = []) {
  const normalizedSupplied = new Map(
    (Array.isArray(suppliedCoverage) ? suppliedCoverage : []).map((entry) => [
      String(entry?.district || "").trim(),
      entry,
    ]),
  );
  const recordsByDistrict = new Map();
  for (const record of records) {
    const district = String(record?.district || "").trim();
    if (!district) continue;
    if (!recordsByDistrict.has(district)) recordsByDistrict.set(district, []);
    recordsByDistrict.get(district).push(record);
  }
  const fileCoverage = minMaxYearMonth(records);
  const coveredDistricts = new Set([
    ...recordsByDistrict.keys(),
    ...normalizedSupplied.keys(),
  ]);

  return [...coveredDistricts].map((district) => {
    const districtRecords = recordsByDistrict.get(district) || [];
    const supplied = normalizedSupplied.get(district);
    const derived = minMaxYearMonth(districtRecords);
    const suppliedStart = supplied?.coverageStart ? new Date(supplied.coverageStart) : null;
    const suppliedEnd = supplied?.coverageEnd ? new Date(supplied.coverageEnd) : null;
    const suppliedValid = suppliedStart
      && suppliedEnd
      && !Number.isNaN(suppliedStart.getTime())
      && !Number.isNaN(suppliedEnd.getTime())
      && suppliedStart <= suppliedEnd;
    if (suppliedValid && supplied?.verifiedComplete === true) {
      return {
        district,
        coverageStart: suppliedStart,
        coverageEnd: suppliedEnd,
        verifiedComplete: true,
        verificationSource: "uploader_confirmation",
      };
    }

    if (supplied?.verifiedComplete === true) {
      return {
        district,
        coverageStart: fileCoverage.coverageStart,
        coverageEnd: fileCoverage.coverageEnd,
        verifiedComplete: true,
        verificationSource: "uploader_confirmation_file_range",
      };
    }

    return {
      district,
      coverageStart: derived.coverageStart,
      coverageEnd: derived.coverageEnd,
      verifiedComplete: false,
      verificationSource: "derived_from_records",
    };
  });
}

function aggregateRecords(records) {
  const byKey = new Map();
  for (const record of records) {
    const key = [
      record.city,
      record.district,
      record.barangayNo,
      record.disease,
      record.year,
      record.month,
      record.epidemiologicalYear,
      record.epidemiologicalWeek,
      record.caseClassification,
      record.source,
      record.surveillanceDateBasis,
    ].join("|");
    const previous = byKey.get(key);
    byKey.set(key, {
      ...record,
      cases: (previous?.cases || 0) + Number(record.cases || 0),
    });
  }
  return Array.from(byKey.values());
}

async function persistOfficialCaseImport({
  datasetPayload,
  normalized,
  providerType,
  providerName,
  reportingFrequency,
}) {
  const session = await mongoose.startSession();
  let dataset = null;
  let insertedRows = 0;

  try {
    await session.withTransaction(async () => {
      dataset = new Dataset({ ...datasetPayload, status: "pending" });
      await dataset.save({ session });

      const docs = aggregateRecords(normalized).map((record) => ({
        ...record,
        datasetId: dataset._id,
        providerType,
        providerName,
        reportingFrequency,
      }));
      await OfficialCase.insertMany(docs, { ordered: false, session });

      insertedRows = docs.length;
      dataset.insertedRows = insertedRows;
      dataset.recordsCount = insertedRows;
      dataset.status = "validated";
      await dataset.save({ session });
    });
  } finally {
    await session.endSession();
  }

  if (!dataset) throw new Error("Dataset import transaction did not complete.");
  try {
    await refreshDashboardSummaryAfterWrite();
  } catch (error) {
    // Dataset and case rows are already committed at this point. A derived
    // dashboard refresh must not turn a durable import into a failed upload.
    console.error("Dashboard summary refresh failed after dataset import:", error?.message || error);
  }
  return { dataset, insertedRows };
}

/**
 * Imports official case XLSX (raw health office or processed template) into OfficialCase (monthly).
 *
 * @returns {Promise<{success:boolean, formatType?:string, datasetId?:string, insertedRows?:number, skippedRows?:number, coverageStart?:string, coverageEnd?:string, diseases?:string[], districts?:string[], validationErrors?:any, reason?:string }>}
 */
export async function importOfficialCasesXlsx({
  fileBuffer,
  datasetId,
  name,
  originalFileName,
  storedFileName,
  mimeType,
  userId,
  providerType = "cesu",
  providerName = "CESU",
  reportingFrequency = "weekly",
  contentHash,
  storageProvider = "r2",
  storageKey,
  fileSize = 0,
  districtCoverage = [],
  declaredCoverageStart,
  declaredCoverageEnd,
  confirmSkipMissing = false,
  beforePersist,
} = {}) {
  const validation = await validateWorkbookIsolated({ fileBuffer, declaredCoverageStart, declaredCoverageEnd });
  const { normalized, ...preview } = validation;
  if (!validation.canUpload) return { ...preview, validationErrors: preview.errors, validationErrorCount: preview.errorCount };
  if (validation.requiresSkipConfirmation && confirmSkipMissing !== true) return {
    ...preview, success: false, canUpload: false, reason: "Explicit confirmation is required before skipping incomplete rows.",
  };
  const coverageStart = new Date(declaredCoverageStart);
  const coverageEnd = new Date(declaredCoverageEnd);
  const resolvedDistrictCoverage = districtCoverageFromRecords(normalized, districtCoverage);
  if (typeof beforePersist === "function") await beforePersist();
  const { dataset, insertedRows } = await persistOfficialCaseImport({
    datasetPayload: {
      _id: datasetId, name: name?.trim() || path.basename(originalFileName || "officialCases.xlsx"),
      dataSource: providerName, providerType, providerName, reportingFrequency, ingestionMethod: "excel",
      coverageStart, coverageEnd, districtCoverage: resolvedDistrictCoverage,
      originalFileName: originalFileName || "officialCases.xlsx", storedFileName: "", filePath: "",
      storageProvider, storageKey, fileSize, mimeType, status: "pending", uploadedBy: userId || null,
      contentHash, formatType: validation.formatType,
      diseases: [...new Set(normalized.map((r) => r.disease))],
      districts: [...new Set([...normalized.map((r) => r.district), ...resolvedDistrictCoverage.map((r) => r.district)])],
      totalRows: validation.totalRows, insertedRows: 0, skippedRows: validation.skippedRows,
      validationErrorCount: 0, validationErrors: null,
    }, normalized, providerType, providerName, reportingFrequency,
  });
  return { success: true, formatType: dataset.formatType, datasetId: String(dataset._id), insertedRows,
    skippedRows: validation.skippedRows, validationErrorCount: 0, validationErrors: [],
    coverageStart: coverageStart.toISOString(), coverageEnd: coverageEnd.toISOString(),
    diseases: dataset.diseases, districts: dataset.districts };
}
