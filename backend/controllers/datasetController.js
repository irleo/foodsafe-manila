import fs from "fs";
import path from "path";
import csv from "csv-parser";
import xlsx from "xlsx";
import Dataset from "../models/Dataset.js";
import OfficialCase from "../models/OfficialCase.js";
import { logActivity } from "../utils/logActivity.js";
import { importOfficialCasesXlsx } from "../services/officialCaseImportService.js";
import { refreshMonthlyDistrictPredictions } from "../services/predictions/refreshMonthlyDistrictPredictions.js";

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

    if (!req.file)
      return res.status(400).json({ message: "No file uploaded." });
    if (!name) {
      return res.status(400).json({ message: "Name is required." });
    }

    const filePath = req.file.path;
    const ext = path.extname(filePath).toLowerCase();

    // Official-case XLSX import (raw health office OR OfficialCaseTemplate)
    if (ext === ".xlsx" || ext === ".xls") {
      const result = await importOfficialCasesXlsx({
        filePath,
        name,
        originalFileName: req.file.originalname,
        storedFileName: req.file.filename,
        mimeType: req.file.mimetype,
        userId: req.user?._id || req.user?.id,
      });

      if (!result.success) {
        cleanupUploadedFile(req);
        return res.status(400).json(result);
      }

      await logActivity({
        actor: req.user?.id,
        actionType: "dataset_validated",
        title: "Official cases imported",
        subtitle: `${name} imported (${result.formatType}).`,
        metadata: { datasetId: result.datasetId, name, formatType: result.formatType },
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

    // CSV uploads are no longer supported for official cases (monthly + classification required)
    if (ext === ".csv") {
      cleanupUploadedFile(req);
      return res.status(400).json({
        success: false,
        reason:
          "CSV uploads are not supported for official cases. Upload a raw health office XLSX or an OfficialCaseTemplate XLSX instead.",
      });
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

    // Legacy forecast trigger removed (predictions now handled by monthly run service).

    await logActivity({
      actor: req.user?.id,
      actionType: "dataset_validated",
      title: "Dataset validated",
      subtitle: `${dataset.name} validated with ${cases.length} records.`,
      metadata: { datasetId: dataset._id, recordsCount: cases.length },
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
    }
    return res.status(500).json({ message: error.message });
  }
};

/**
 * =========================
 * listDatasets / downloadDataset
 * =========================
 */

export const listDatasets = async (req, res) => {
  try {
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

    const datasets = await Dataset.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .select(
        "name originalFileName storedFileName recordsCount status coverageStart coverageEnd createdAt uploadedAt errorMessage",
      );

    res.json(datasets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const downloadDataset = async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id);
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
      ["- case_classification: confirmed | suspected | probable"],
      ["- cases: numeric (integer)"],
      ["- source: optional, defaults to official"],
      [""],
      ["Notes:"],
      ["- Keep one row per month per district per disease per classification."],
      ["- Upload this XLSX as-is when ready."],
    ];

    const header = [
      "city",
      "district",
      "disease",
      "year",
      "month",
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
