import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import xlsx from "xlsx";
import Dataset from "../models/Dataset.js";
import { paginationMeta, parsePagination } from "../utils/pagination.js";
import { logActivity } from "../utils/logActivity.js";
import { importOfficialCasesXlsx } from "../services/officialCaseImportService.js";
import { refreshMonthlyDistrictPredictions } from "../services/predictions/refreshMonthlyDistrictPredictions.js";
import { createNotification } from "../services/notificationService.js";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

function cleanupUploadedFile(req) {
  try {
    const p = req?.file?.path;
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  } catch (error) {
    console.error("Failed to clean up uploaded file:", error?.message || error);
  }
}

async function calculateFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

/**
 * =========================
 * Controller: uploadDataset
 * =========================
 */

export const uploadDataset = async (req, res) => {
  let dataset = null;

  try {
    const { name, dataSource } = req.body;
    const providerType = String(req.body.providerType || "").trim().toLowerCase();
    const providerName = String(req.body.providerName || dataSource || "").trim();
    const reportingFrequency = String(req.body.reportingFrequency || "weekly")
      .trim()
      .toLowerCase();
    const allowedProviderTypes = new Set([
      "hospital",
      "health_center",
      "cesu",
      "doh",
    ]);

    if (!req.file)
      return res.status(400).json({ message: "No file uploaded." });
    if (!name) {
      cleanupUploadedFile(req);
      return res.status(400).json({ message: "Name is required." });
    }
    if (!allowedProviderTypes.has(providerType)) {
      cleanupUploadedFile(req);
      return res.status(400).json({ message: "Select a valid dataset source." });
    }
    if (!providerName) {
      cleanupUploadedFile(req);
      return res.status(400).json({ message: "Provider or facility name is required." });
    }
    if (!["weekly", "monthly"].includes(reportingFrequency)) {
      cleanupUploadedFile(req);
      return res.status(400).json({ message: "Reporting frequency must be weekly or monthly." });
    }

    const filePath = req.file.path;
    const ext = path.extname(filePath).toLowerCase();

    if (ext !== ".xlsx" && ext !== ".xls") {
      cleanupUploadedFile(req);
      return res.status(400).json({
        message: "Unsupported file type. Upload an Excel workbook (.xlsx/.xls).",
      });
    }

    const contentHash = await calculateFileSha256(filePath);
    const duplicate = await Dataset.findOne({ contentHash })
      .select("name originalFileName status createdAt")
      .lean();
    if (duplicate) {
      cleanupUploadedFile(req);
      return res.status(409).json({
        message: `This exact file was already uploaded as "${duplicate.name}". Renaming the file does not create a new dataset.`,
        duplicate: {
          datasetId: String(duplicate._id),
          name: duplicate.name,
          originalFileName: duplicate.originalFileName,
          status: duplicate.status,
          createdAt: duplicate.createdAt,
        },
      });
    }

    const result = await importOfficialCasesXlsx({
      filePath,
      name,
      originalFileName: req.file.originalname,
      storedFileName: req.file.filename,
      mimeType: req.file.mimetype,
      userId: req.user?._id || req.user?.id,
      providerType,
      providerName,
      reportingFrequency,
      contentHash,
    });

    if (!result.success) {
      dataset = await Dataset.create({
        name,
        dataSource: providerName,
        providerType,
        providerName,
        reportingFrequency,
        ingestionMethod: "excel",
        coverageStart: new Date(),
        coverageEnd: new Date(),
        originalFileName: req.file.originalname,
        storedFileName: req.file.filename,
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        status: "failed",
        uploadedBy: req.user?._id || req.user?.id,
        errorMessage: result?.reason || "Validation failed.",
        formatType: result?.formatType || "unrecognized_excel",
        validationErrors: result?.validationErrors || null,
        insertedRows: 0,
        skippedRows:
          result?.validationErrorCount || result?.validationErrors?.length || 0,
        validationErrorCount:
          result?.validationErrorCount || result?.validationErrors?.length || 0,
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
      metadata: {
        datasetId: result.datasetId,
        name,
        insertedRows: result.insertedRows,
      },
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
  } catch (error) {
    cleanupUploadedFile(req);

    if (error?.code === 11000 && error?.keyPattern?.contentHash) {
      return res.status(409).json({
        message: "This exact Excel file has already been uploaded. Renaming it does not create a new dataset.",
      });
    }

    if (dataset) {
      dataset.status = "failed";
      dataset.errorMessage = error.message || "Upload failed.";
      await dataset.save().catch((saveError) => {
        console.error("Failed to mark dataset as failed:", saveError?.message || saveError);
      });
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
      formatType: "unrecognized_excel",
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
          "name dataSource providerType providerName reportingFrequency ingestionMethod originalFileName storedFileName recordsCount status coverageStart coverageEnd createdAt errorMessage uploadedBy formatType totalRows insertedRows skippedRows validationErrorCount validationErrors",
        )
        .populate("uploadedBy", "username email role")
        .lean(),
      Dataset.countDocuments(filter),
    ]);

    const items = datasets.map((entry) => {
      const validationErrors = Array.isArray(entry.validationErrors)
        ? entry.validationErrors
        : [];
      return {
        ...entry,
        validationErrorCount: Number.isFinite(entry.validationErrorCount)
          ? entry.validationErrorCount
          : validationErrors.length,
        validationErrors: validationErrors.slice(0, 5),
      };
    });

    res.json({
      items,
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

    const filename = dataset.originalFileName || `${dataset.name}.xlsx`;
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
      "barangay",
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
        barangay: "District 105", 
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
