import fs from "fs";
import path from "path";
import csv from "csv-parser";
import xlsx from "xlsx";
import Dataset from "../models/Dataset.js";
import OfficialCase from "../models/OfficialCase.js";
import { paginationMeta, parsePagination } from "../utils/pagination.js";
import { refreshDashboardSummaryAfterWrite } from "../services/dashboardSummaryService.js";
import { logActivity } from "../utils/logActivity.js";
import {
  importOfficialCasesCsv,
  importOfficialCasesXlsx,
} from "../services/officialCaseImportService.js";
import { refreshMonthlyDistrictPredictions } from "../services/predictions/refreshMonthlyDistrictPredictions.js";
import { createNotification } from "../services/notificationService.js";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

/**
 * =========================
 * Parsing
 * =========================
 */

function cleanupUploadedFile(req) {
  try {
    const p = req?.file?.path;
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  } catch (_) {
    // ignore cleanup errors
  }
}

// CSV Parser
async function parseCsv(filePath) {
  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => rows.push(data))
      .on("end", resolve)
      .on("error", reject);
  });
  return rows;
}

// EXCEL Parser
function parseExcel(filePath) {
  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames?.[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet, { defval: "" });
}

/**
 * =========================
 * Mapping + Validation Helpers
 * =========================
 */

// Canonical required fields for your dataset schema
const REQUIRED_FIELDS = ["city", "district", "disease", "year", "cases"];

// Aliases you accept from CSV/XLSX headers (case variations + alternate words)
const HEADER_ALIASES = {
  city: ["city", "City", "CITY"],
  district: [
    "district",
    "District",
    "DISTRICT",
    "area",
    "Area",
    "barangay",
    "Barangay",
    "brgy",
    "Brgy",
  ],
  disease: [
    "disease",
    "Disease",
    "DISEASE",
    "illness",
    "Illness",
    "condition",
    "Condition",
  ],
  year: ["year", "Year", "YEAR"],
  cases: [
    "cases",
    "Cases",
    "CASE",
    "case",
    "count",
    "Count",
    "case_count",
    "Case Count",
    "Case_Count",
  ],
};

function normalizeKey(k) {
  return String(k ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function pick(row, keys) {
  // Tries exact keys first (as supplied), then normalized matching
  for (const k of keys) {
    if (row?.[k] !== undefined && row?.[k] !== null && row?.[k] !== "")
      return row[k];
  }

  // Fallback: try normalized keys (helps with "Case Count" vs "case_count", etc.)
  const normalizedRow = {};
  for (const [rk, rv] of Object.entries(row || {})) {
    normalizedRow[normalizeKey(rk)] = rv;
  }
  for (const k of keys) {
    const nk = normalizeKey(k);
    if (
      normalizedRow?.[nk] !== undefined &&
      normalizedRow?.[nk] !== null &&
      normalizedRow?.[nk] !== ""
    ) {
      return normalizedRow[nk];
    }
  }

  return undefined;
}

function getMissingHeaders(rawRows) {
  if (!rawRows || rawRows.length === 0) return REQUIRED_FIELDS;

  const headerKeys = Object.keys(rawRows[0] || {});
  const headerSet = new Set(headerKeys.map(normalizeKey));

  const missing = [];

  for (const field of REQUIRED_FIELDS) {
    const aliases = HEADER_ALIASES[field] || [field];
    const ok = aliases.some((a) => headerSet.has(normalizeKey(a)));
    if (!ok) missing.push(field);
  }

  return missing;
}

function safeNumber(v) {
  if (v === undefined || v === null || v === "") return NaN;
  // remove commas (e.g., "1,234")
  const n = Number(String(v).replace(/,/g, "").trim());
  return n;
}

function rowToOfficialCase(row, datasetId, sourceLabel = "file") {
  const district = String(pick(row, HEADER_ALIASES.district) ?? "").trim();
  const disease = String(pick(row, HEADER_ALIASES.disease) ?? "").trim();
  const city = String(pick(row, HEADER_ALIASES.city) ?? "Manila").trim();

  const yearRaw = pick(row, HEADER_ALIASES.year);
  const casesRaw = pick(row, HEADER_ALIASES.cases);

  const year = safeNumber(yearRaw);
  const cases = safeNumber(casesRaw);

  // Rule checks
  if (!district) return { ok: false, reason: "District is required." };
  if (!disease) return { ok: false, reason: "Disease is required." };
  if (!Number.isFinite(year) || !Number.isInteger(year))
    return { ok: false, reason: "Year must be an integer." };
  if (year < 2015 || year > 2100)
    return { ok: false, reason: "Year out of allowed range (2015–2100)." };
  if (!Number.isFinite(cases) || !Number.isInteger(cases))
    return { ok: false, reason: "Cases must be an integer." };
  if (cases < 0) return { ok: false, reason: "Cases cannot be negative." };

  return {
    ok: true,
    value: {
      datasetId,
      city,
      district,
      disease,
      year,
      cases,
      source: sourceLabel,
    },
  };
}

function validateAndMapRows(
  rawRows,
  datasetId,
  { coverageStart, coverageEnd, sourceLabel },
) {
  const report = {
    ok: true,
    rowCount: rawRows.length,
    validCount: 0,
    invalidCount: 0,
    missingHeaders: [],
    // Keep only a small sample of invalid row details for response clarity
    invalidSamples: [], // [{ row: 12, reason: "..." }]
    warnings: [],
  };

  if (!rawRows || rawRows.length === 0) {
    report.ok = false;
    report.missingHeaders = REQUIRED_FIELDS;
    report.invalidCount = 0;
    return { report, cases: [] };
  }

  // Header validation (explicit, instead of "no valid rows found")
  const missing = getMissingHeaders(rawRows);
  if (missing.length) {
    report.ok = false;
    report.missingHeaders = missing;
    return { report, cases: [] };
  }

  // Optional: warn if coverageStart/end exist and years are outside the range
  const startYear = coverageStart
    ? new Date(coverageStart).getFullYear()
    : null;
  const endYear = coverageEnd ? new Date(coverageEnd).getFullYear() : null;

  const cases = [];
  const seen = new Set(); // duplicate detection: city|district|disease|year

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 2; // spreadsheet row number (header is 1)
    const mapped = rowToOfficialCase(rawRows[i], datasetId, sourceLabel);

    if (!mapped.ok) {
      report.invalidCount++;
      if (report.invalidSamples.length < 20) {
        report.invalidSamples.push({ row: rowNum, reason: mapped.reason });
      }
      continue;
    }

    const oc = mapped.value;

    // Coverage warnings (do not fail)
    if (startYear !== null && endYear !== null) {
      if (oc.year < startYear || oc.year > endYear) {
        if (report.warnings.length < 20) {
          report.warnings.push({
            row: rowNum,
            message: `Year ${oc.year} is outside coverage years (${startYear}–${endYear}).`,
          });
        }
      }
    }

    // Duplicate warnings (do not fail)
    const key = `${oc.city.toLowerCase()}|${oc.district.toLowerCase()}|${oc.disease.toLowerCase()}|${oc.year}`;
    if (seen.has(key)) {
      if (report.warnings.length < 20) {
        report.warnings.push({
          row: rowNum,
          message: `Duplicate row for same city/district/disease/year.`,
        });
      }
      // You can choose to skip duplicates or keep them; skipping is safer:
      continue;
    }
    seen.add(key);

    cases.push(oc);
  }

  report.validCount = cases.length;

  // Fail if nothing valid
  if (cases.length === 0) {
    report.ok = false;
  }

  return { report, cases };
}

/**
 * =========================
 * Controller: uploadDataset
 * =========================
 */

export const uploadDataset = async (req, res) => {
  let dataset = null;

  try {
    const { name, coverageStart, coverageEnd, dataSource } = req.body;
    const providerType = String(req.body.providerType || "").trim().toLowerCase();
    const providerName = String(req.body.providerName || dataSource || "").trim();
    const reportingFrequency = String(req.body.reportingFrequency || "weekly").trim().toLowerCase();
    const allowedProviderTypes = new Set(["hospital", "health_center", "cesu", "doh"]);

    if (!req.file)
      return res.status(400).json({ message: "No file uploaded." });
    if (!name) {
      return res.status(400).json({ message: "Name is required." });
    }
    if (!allowedProviderTypes.has(providerType)) {
      return res.status(400).json({ message: "Select a valid dataset source." });
    }
    if (!providerName) {
      return res.status(400).json({ message: "Provider or facility name is required." });
    }
    if (!["weekly", "monthly"].includes(reportingFrequency)) {
      return res.status(400).json({ message: "Reporting frequency must be weekly or monthly." });
    }

    const filePath = req.file.path;
    const ext = path.extname(filePath).toLowerCase();

    // Official-case import (XLSX raw/template or CSV template)
    if (ext === ".xlsx" || ext === ".xls" || ext === ".csv") {
      const importer =
        ext === ".csv" ? importOfficialCasesCsv : importOfficialCasesXlsx;

      const result = await importer({
        filePath,
        name,
        originalFileName: req.file.originalname,
        storedFileName: req.file.filename,
        mimeType: req.file.mimetype,
        userId: req.user?._id || req.user?.id,
        providerType,
        providerName,
        reportingFrequency,
      });

      if (!result.success) {
        dataset = await Dataset.create({
          name,
          dataSource: providerName,
          providerType,
          providerName,
          reportingFrequency,
          ingestionMethod: ext === ".csv" ? "csv" : "excel",
          coverageStart: new Date(),
          coverageEnd: new Date(),
          originalFileName: req.file.originalname,
          storedFileName: req.file.filename,
          filePath: req.file.path,
          mimeType: req.file.mimetype,
          status: "failed",
          uploadedBy: req.user?._id || req.user?.id,
          errorMessage: result?.reason || "Validation failed.",
          formatType: result?.formatType || "csv_generic",
          validationErrors: result?.validationErrors || null,
          insertedRows: 0,
          skippedRows: 0,
          totalRows: 0,
        });

        cleanupUploadedFile(req);
        await createNotification({
          type: "dataset_failed",
          title: "Dataset Validation Failed",
          message: `${name}: ${result?.reason || "Validation failed."}`,
          dotColor: "red",
          metadata: {
            datasetId: String(dataset._id),
            name,
            reason: result?.reason || null,
          },
        });
        await logActivity({
          actor: req.user?.id,
          actionType: "dataset_failed",
          title: "Dataset validation failed",
          subtitle: `${name} failed validation.`,
          metadata: {
            datasetId: String(dataset._id),
            name,
            reason: result?.reason || "Validation failed.",
          },
        });
        return res.status(400).json(result);
      }

      await logActivity({
        actor: req.user?.id,
        actionType: "dataset_validated",
        title: "Official cases imported",
        subtitle: `${name} imported (${result.formatType}).`,
        metadata: {
          datasetId: result.datasetId,
          name,
          formatType: result.formatType,
          providerType,
          providerName,
          reportingFrequency,
        },
      });

      await createNotification({
        type: "dataset_validated",
        title: "Dataset Validated",
        message: `${name} validated successfully${Number.isFinite(result.insertedRows) ? ` (${result.insertedRows} records)` : ""}.`,
        dotColor: "green",
        metadata: { datasetId: result.datasetId, name, insertedRows: result.insertedRows },
      });

      // Non-blocking prediction refresh. Upload succeeds even if prediction fails.
      console.log(
        "Starting monthly district prediction refresh for datasetId:",
        result.datasetId,
      );
      refreshMonthlyDistrictPredictions({
        trigger: "official_upload",
        datasetId: result.datasetId,
        horizonMonths: 1,
        force: true,
      })
        .then((saved) => {
          console.log(
            "PredictionRun saved:",
            saved?._id?.toString?.() || saved?._id || "(unknown)",
          );
        })
        .catch((e) => {
          console.error("Prediction refresh failed:", e?.message || e);
        });

      return res.status(201).json(result);
    }

    // Create dataset record early (keeps audit trail even for failures)
    dataset = await Dataset.create({
      name,
      dataSource,
      coverageStart: new Date(),
      coverageEnd: new Date(),

      originalFileName: req.file.originalname,
      storedFileName: req.file.filename,
      filePath: req.file.path,
      mimeType: req.file.mimetype,

      status: "pending",
      uploadedBy: req.user?._id || req.user?.id,
    });

    await logActivity({
      actor: req.user?.id,
      actionType: "dataset_uploaded",
      title: "Dataset uploaded",
      subtitle: `${name} uploaded and pending validation.`,
      metadata: { datasetId: dataset._id, name },
    });

    // Parse (legacy path)
    let rawRows = [];
    let sourceLabel = "file";

    if (ext === ".csv") {
      rawRows = await parseCsv(filePath);
      sourceLabel = "csv";
    } else if (ext === ".xlsx" || ext === ".xls") {
      rawRows = parseExcel(filePath);
      sourceLabel = "excel";
    } else {
      dataset.status = "failed";
      dataset.errorMessage = "Unsupported file type.";
      await dataset.save();

      // Delete failed uploads
      cleanupUploadedFile(req);

      return res.status(400).json({ message: dataset.errorMessage });
    }

    // Validate + map (legacy)
    const { report, cases } = validateAndMapRows(rawRows, dataset._id, {
      coverageStart,
      coverageEnd,
      sourceLabel,
    });

    if (!report.ok) {
      dataset.status = "failed";
      dataset.errorMessage = report.missingHeaders?.length
        ? `Missing required columns: ${report.missingHeaders.join(", ")}.`
        : "No valid rows found. Check your columns/format.";

      await dataset.save();
      await createNotification({
        type: "dataset_failed",
        title: "Dataset Validation Failed",
        message: `${dataset.name}: ${dataset.errorMessage}`,
        dotColor: "red",
        metadata: { datasetId: String(dataset._id), name: dataset.name },
      });
      await logActivity({
        actor: req.user?.id,
        actionType: "dataset_failed",
        title: "Dataset validation failed",
        subtitle: `${dataset.name} failed validation.`,
        metadata: {
          datasetId: String(dataset._id),
          name: dataset.name,
          reason: dataset.errorMessage,
        },
      });

      cleanupUploadedFile(req);

      return res.status(400).json({
        message: dataset.errorMessage,
        validation: report,
      });
    }

    // Insert cases (replaces dataset contents)
    await OfficialCase.deleteMany({ datasetId: dataset._id });
    await OfficialCase.insertMany(cases, { ordered: false });

    dataset.recordsCount = cases.length;
    dataset.status = "validated";
    dataset.errorMessage = "";
    // Optional: store report summary if your schema supports it
    dataset.validationSummary = {
      rowCount: report.rowCount,
      validCount: report.validCount,
      invalidCount: report.invalidCount,
      warningsCount: report.warnings.length,
    };
    await dataset.save();
    await refreshDashboardSummaryAfterWrite();

    // Legacy forecast trigger removed (predictions now handled by monthly run service).

    await logActivity({
      actor: req.user?.id,
      actionType: "dataset_validated",
      title: "Dataset validated",
      subtitle: `${dataset.name} validated with ${cases.length} records.`,
      metadata: { datasetId: dataset._id, recordsCount: cases.length },
    });

    await createNotification({
      type: "dataset_validated",
      title: "Dataset Validated",
      message: `${dataset.name} validated successfully (${cases.length} records).`,
      dotColor: "green",
      metadata: { datasetId: String(dataset._id), name: dataset.name, recordsCount: cases.length },
    });

    return res.status(201).json({
      message: "Dataset uploaded and validated.",
      dataset,
      validation: report, // includes warnings + sample invalid rows
    });
  } catch (error) {
    cleanupUploadedFile(req);

    if (dataset) {
      dataset.status = "failed";
      dataset.errorMessage = error.message || "Upload failed.";
      await dataset.save().catch(() => {});
      await createNotification({
        type: "dataset_failed",
        title: "Dataset Validation Failed",
        message: `${dataset.name}: ${dataset.errorMessage}`,
        dotColor: "red",
        metadata: { datasetId: String(dataset._id), name: dataset.name },
      });
      await logActivity({
        actor: req.user?.id,
        actionType: "dataset_failed",
        title: "Dataset upload failed",
        subtitle: `${dataset.name} upload failed.`,
        metadata: {
          datasetId: String(dataset._id),
          name: dataset.name,
          reason: dataset.errorMessage,
        },
      });
    }
    return res.status(500).json({ message: error.message });
  }
};

export const handleDatasetUploadError = async (err, req, res, next) => {
  if (!err) return next();

  try {
    const name = String(req.body?.name || "").trim() || "Unnamed upload";
    const originalFileName =
      req.file?.originalname || String(req.body?.originalFileName || "unknown");
    const storedFileName = req.file?.filename || "upload_rejected";
    const filePath = req.file?.path || "upload_rejected";
    const mimeType = req.file?.mimetype || String(req.body?.mimeType || "");
    const reason = err?.message || "Upload rejected.";

    const failed = await Dataset.create({
      name,
      dataSource: "official_upload",
      coverageStart: new Date(),
      coverageEnd: new Date(),
      originalFileName,
      storedFileName,
      filePath,
      mimeType,
      status: "failed",
      uploadedBy: req.user?._id || req.user?.id || null,
      errorMessage: reason,
      formatType: "csv_generic",
      validationErrors: [{ field: "upload", message: reason }],
      insertedRows: 0,
      skippedRows: 0,
      totalRows: 0,
    });

    await createNotification({
      type: "dataset_failed",
      title: "Dataset Upload Rejected",
      message: `${name}: ${reason}`,
      dotColor: "red",
      metadata: { datasetId: String(failed._id), name, reason },
    });

    await logActivity({
      actor: req.user?.id,
      actionType: "dataset_failed",
      title: "Dataset upload rejected",
      subtitle: `${name} was rejected during upload.`,
      metadata: {
        datasetId: String(failed._id),
        name,
        reason,
      },
    });
  } catch (saveErr) {
    console.error("Failed to persist upload rejection:", saveErr?.message || saveErr);
  }

  return res.status(400).json({ message: err?.message || "Upload rejected." });
};

/**
 * =========================
 * listDatasets / downloadDataset
 * =========================
 */

export const listDatasets = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const statusParam = String(req.query.status || "validated").toLowerCase();

    let filter = {};
    if (statusParam === "all") {
      filter = {}; // no filter
    } else {
      const statuses = statusParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      // Safety: only allow known statuses
      const allowed = new Set(["validated", "failed", "pending"]);
      const safeStatuses = statuses.filter((s) => allowed.has(s));

      filter = safeStatuses.length
        ? { status: { $in: safeStatuses } }
        : { status: "validated" };
    }

    const [datasets, total] = await Promise.all([
      Dataset.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "name dataSource providerType providerName reportingFrequency ingestionMethod originalFileName storedFileName recordsCount status coverageStart coverageEnd createdAt errorMessage uploadedBy",
        )
        .populate("uploadedBy", "username email role")
        .lean(),
      Dataset.countDocuments(filter),
    ]);

    res.json({
      items: datasets,
      pagination: paginationMeta({ page, limit, total }),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const downloadDataset = async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id)
      .select("name originalFileName filePath")
      .lean();
    if (!dataset)
      return res.status(404).json({ message: "Dataset not found." });

    if (!dataset.filePath || !fs.existsSync(dataset.filePath)) {
      return res.status(404).json({ message: "File missing on server." });
    }

    const filename = dataset.originalFileName || `${dataset.name}.csv`;
    res.download(dataset.filePath, filename);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const downloadOfficialCaseTemplate = async (req, res) => {
  try {
    const instructions = [
      ["OfficialCaseTemplate (processed upload)"],
      [""],
      ["How to fill:"],
      ["- city: Manila (or your city name)"],
      ["- district: District 1..District 6 (or your district naming)"],
      ["- disease: disease name (e.g. Cholera)"],
      ["- year: 4-digit year"],
      ["- month: 1–12"],
      ["- epidemiological_year: ISO epidemiological year"],
      ["- epidemiological_week: 1–53 (required for weekly datasets)"],
      ["- week_start_date: Monday of the reporting week (YYYY-MM-DD)"],
      ["- case_classification: confirmed | suspected | probable"],
      ["- cases: numeric (integer)"],
      ["- source: optional, defaults to official"],
      [""],
      ["Notes:"],
      ["- Keep one row per week per district, barangay, disease, and classification for weekly data."],
      ["- Upload this XLSX as-is when ready."],
    ];

    const header = [
      "city",
      "district",
      "disease",
      "year",
      "month",
      "epidemiological_year",
      "epidemiological_week",
      "week_start_date",
      "case_classification",
      "cases",
      "source",
    ];

    const sampleRows = [
      {
        city: "Manila",
        district: "District 1",
        disease: "Cholera",
        year: 2026,
        month: 1,
        epidemiological_year: 2026,
        epidemiological_week: 2,
        week_start_date: "2026-01-05",
        case_classification: "confirmed",
        cases: 3,
        source: "official",
      },
    ];

    const wb = xlsx.utils.book_new();
    const shInstructions = xlsx.utils.aoa_to_sheet(instructions);
    xlsx.utils.book_append_sheet(wb, shInstructions, "instructions");

    const shProcessed = xlsx.utils.json_to_sheet(sampleRows, {
      header,
      skipHeader: false,
    });
    xlsx.utils.book_append_sheet(wb, shProcessed, "processed data");

    const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="official_cases_template.xlsx"`
    );
    return res.send(buf);
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Server error" });
  }
};
