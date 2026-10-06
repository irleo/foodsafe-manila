import { afterDatasetSave } from "../services/afterDatasetSave.js";
import { validateWorkbookIsolated } from "../services/validateWorkbookIsolated.js";
import { previewFingerprint, issuePreviewToken, verifyPreviewToken } from "../services/datasetPreviewToken.js";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { pipeline } from "stream/promises";
import mongoose from "mongoose";
import Dataset from "../models/Dataset.js";
import PredictionRun from "../models/PredictionRun.js";
import { paginationMeta, parsePagination } from "../utils/pagination.js";
import { logActivity } from "../utils/logActivity.js";
import { importOfficialCasesXlsx } from "../services/officialCaseImportService.js";
import { refreshMonthlyDistrictPredictions } from "../services/predictions/refreshMonthlyDistrictPredictions.js";
import { startGitHubForecast, usesGitHubForecasts } from "../services/predictions/githubForecastJobs.js";
import { createNotification } from "../services/notificationService.js";
import { resolveCumulativeDatasetSummaries } from "../services/cumulativeOfficialCaseService.js";
import {
  isSafePublicMessage,
  sanitizeValidationErrors,
} from "../middleware/errorHandler.js";
import { logServerError, logRequestError } from "../utils/serverLogger.js";
import {
  deleteDatasetObject,
  getDatasetObject,
  uploadDatasetObject,
} from "../services/r2StorageService.js";

const OFFICIAL_PROVIDER_TYPE = "cesu";
const OFFICIAL_PROVIDER_NAME = "CESU";
const OFFICIAL_TEMPLATE_STORAGE_KEY = "templates/FoodSafe_Template.xlsx";
const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PREDICTION_GRANULARITY = "monthly_disease_district_cases";
const DEFAULT_PREDICTION_REFRESH_TIMEOUT_MS = 12 * 60 * 1000;



function predictionRefreshTimeoutMs() {
  const parsed = Number.parseInt(process.env.PREDICTION_REFRESH_TIMEOUT_MS, 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_PREDICTION_REFRESH_TIMEOUT_MS;
}

async function startDatasetPredictionRefresh(datasetId) {
  try {
    if (usesGitHubForecasts()) {
      await startGitHubForecast({ datasetId, trigger: "official_upload" });
      return;
    }
  } catch (error) {
    logServerError(error, { code: "PREDICTION_DISPATCH_FAILED", route: "dataset:upload" });
    return;
  }
  if (!mongoose.Types.ObjectId.isValid(datasetId)) {
    logServerError(new Error("Prediction refresh received an invalid dataset ID."), {
      code: "PREDICTION_JOB_INVALID_DATASET_ID",
      route: "dataset:upload",
    });
    return;
  }

  // Mongoose preserves strings assigned to Mixed fields. Normalize this once so
  // the worker's ObjectId-scoped update can match the durable running job.
  const normalizedDatasetId = new mongoose.Types.ObjectId(datasetId);
  let job;
  try {
    job = await PredictionRun.create({
      model: "prophet",
      granularity: PREDICTION_GRANULARITY,
      datasetScope: normalizedDatasetId,
      basisDatasetId: normalizedDatasetId,
      trigger: "official_upload",
      status: "running",
      startedAt: new Date(),
      forecastHorizonMonths: 1,
    });
  } catch (error) {
    if (error?.code === 11000) {
      console.log(
        "Prediction refresh already active for datasetId:",
        String(normalizedDatasetId),
      );
      return;
    }
    logServerError(error, {
      code: "PREDICTION_JOB_CREATE_FAILED",
      route: "dataset:upload",
    });
    return;
  }

  const timeoutMs = predictionRefreshTimeoutMs();
  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort(
      new Error(`Prediction refresh exceeded its ${timeoutMs} ms time limit.`),
    );
  }, timeoutMs);
  timeout.unref?.();

  void refreshMonthlyDistrictPredictions({
    trigger: "official_upload",
    datasetId: normalizedDatasetId,
    predictionRunId: job._id,
    horizonMonths: 1,
    force: true,
    signal: abortController.signal,
  })
    .then((saved) => {
      console.log(
        "PredictionRun saved:",
        saved?._id?.toString?.() || saved?._id || "(unknown)",
      );
    })
    .catch(async (error) => {
      logServerError(error, {
        code: "PREDICTION_REFRESH_FAILED",
        route: "dataset:upload",
      });
      try {
        await PredictionRun.updateOne(
          { _id: job._id, status: "running" },
          {
            $set: {
              status: "failed",
              finishedAt: new Date(),
              errorMessage: "Prediction refresh could not be completed.",
            },
          },
        );
      } catch (updateError) {
        logServerError(updateError, {
          code: "PREDICTION_STATUS_UPDATE_FAILED",
          route: "dataset:upload",
        });
      }
    })
    .finally(() => clearTimeout(timeout));
}

function calculateFileSha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function streamObjectDownload(res, { object, filename, fallbackMimeType }) {
  if (!object?.Body) throw new Error("Stored object has no downloadable body.");
  const safeAsciiName = filename
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/[\r\n"\\]/g, "_");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  res.setHeader(
    "Content-Type",
    object.ContentType || fallbackMimeType || "application/octet-stream",
  );
  if (Number.isFinite(object.ContentLength)) {
    res.setHeader("Content-Length", String(object.ContentLength));
  }

  if (typeof object.Body.pipe === "function") {
    await pipeline(object.Body, res);
    return;
  }
  const bytes = await object.Body.transformToByteArray();
  res.end(Buffer.from(bytes));
}

/**
 * =========================
 * Controller: uploadDataset
 * =========================
 */

export const uploadDataset = async (req, res) => {
  let uploadedStorageKey = "";

  try {
    const { name } = req.body;
    // CESU is the sole authoritative uploader. Provider metadata is assigned
    // server-side so a custom client cannot introduce another official source.
    const providerType = OFFICIAL_PROVIDER_TYPE;
    const providerName = OFFICIAL_PROVIDER_NAME;
    const reportingFrequency = "weekly";
    const coverageStartText = String(req.body.coverageStart || "").trim();
    const coverageEndText = String(req.body.coverageEnd || "").trim();
    const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateOnlyPattern.test(coverageStartText) || !dateOnlyPattern.test(coverageEndText)) {
      return res.status(400).json({ message: "Coverage start and end dates are required." });
    }
    const coverageStart = new Date(`${coverageStartText}T00:00:00.000Z`);
    const coverageEnd = new Date(`${coverageEndText}T23:59:59.999Z`);
    if (
      Number.isNaN(coverageStart.getTime())
      || Number.isNaN(coverageEnd.getTime())
      || coverageStart.toISOString().slice(0, 10) !== coverageStartText
      || coverageEnd.toISOString().slice(0, 10) !== coverageEndText
      || coverageStart > coverageEnd
    ) {
      return res.status(400).json({ message: "Coverage end must be on or after coverage start." });
    }
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);
    if (coverageEnd > todayEnd) {
      return res.status(400).json({ message: "Coverage end cannot be in the future." });
    }
    const districtCoverage = Array.from({ length: 6 }, (_, index) => ({
      district: `District ${index + 1}`,
      coverageStart,
      coverageEnd,
      verifiedComplete: true,
    }));
    if (!req.file)
      return res.status(400).json({ message: "No file uploaded." });
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Name is required." });
    }

    const originalFileName = path.basename(req.file.originalname);
    const ext = path.extname(originalFileName).toLowerCase();

    if (ext !== ".xlsx" && ext !== ".xls") {
      return res.status(400).json({
        message: "Unsupported file type. Upload an Excel workbook (.xlsx/.xls).",
      });
    }

    if (req.body.coverageVerified !== "true") {
      return res.status(400).json({ message: "Confirm complete reporting coverage for all six districts." });
    }
    const fingerprint = previewFingerprint(req.file.buffer, req.body, req.user?._id || req.user?.id);
    const previewOnly = req.path === "/validate";
    if (!previewOnly && !verifyPreviewToken(req.body.validationToken, fingerprint)) {
      return res.status(400).json({ message: "Validate this workbook and confirm its preview before uploading. The preview may have expired or the file or metadata changed." });
    }
    const contentHash = calculateFileSha256(req.file.buffer);
    const duplicate = await Dataset.findOne({ contentHash })
      .select("name originalFileName status createdAt formatType insertedRows skippedRows coverageStart coverageEnd diseases districts")
      .lean();
    if (duplicate) {
      const message = `This exact file was already uploaded as "${duplicate.name}". Renaming it does not create a new dataset.`;
      if (previewOnly) return res.status(200).json({
        success: false, canUpload: false, reason: message, validationToken: null,
        errorCount: 1, warningCount: 0, validRowCount: 0, totalRows: 0,
        errors: [{ sheet: null, row: null, field: "workbook", message }], warnings: [], validRecords: [],
      });
      if (duplicate.status === "validated") return res.status(200).json({
        success: true, alreadyImported: true, datasetId: String(duplicate._id),
        formatType: duplicate.formatType, insertedRows: duplicate.insertedRows,
        skippedRows: duplicate.skippedRows, coverageStart: duplicate.coverageStart,
        coverageEnd: duplicate.coverageEnd, diseases: duplicate.diseases, districts: duplicate.districts,
      });
      return res.status(409).json({ message });
    }

    const { normalized, ...preview } = await validateWorkbookIsolated({
      fileBuffer: req.file.buffer, declaredCoverageStart: coverageStart, declaredCoverageEnd: coverageEnd,
    });
    if (previewOnly) {
      return res.status(200).json({ ...preview, validationToken: preview.canUpload ? issuePreviewToken(fingerprint) : null });
    }
    if (!preview.canUpload) return res.status(400).json({ ...preview, validationErrors: preview.errors });
    if (preview.requiresSkipConfirmation && req.body.confirmSkipMissing !== "true") {
      return res.status(400).json({ message: `Confirm that ${preview.missingFieldRows} incomplete rows will be skipped and excluded from imported records and case totals.` });
    }

    const datasetId = new mongoose.Types.ObjectId();
    const storageKey = `datasets/${datasetId}/original${ext}`;
    const result = await importOfficialCasesXlsx({
      fileBuffer: req.file.buffer,
      datasetId,
      name,
      originalFileName,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      userId: req.user?._id || req.user?.id,
      providerType,
      providerName,
      reportingFrequency,
      contentHash,
      storageProvider: "r2",
      storageKey,
      districtCoverage,
      declaredCoverageStart: coverageStart,
      declaredCoverageEnd: coverageEnd,
      confirmSkipMissing: req.body.confirmSkipMissing === "true",
      beforePersist: async () => {
        await uploadDatasetObject({
          storageKey,
          buffer: req.file.buffer,
          mimeType: req.file.mimetype,
          contentHash,
        });
        uploadedStorageKey = storageKey;
      },
    });

    if (!result.success) return res.status(400).json(result);
    // The database now owns the R2 object reference; later notification/audit
    // failures must not remove a successfully persisted original workbook.
    uploadedStorageKey = "";

    await afterDatasetSave(() => logActivity({
      actor: req.user?._id || req.user?.id,
      actionType: "dataset_uploaded",
      title: "Dataset uploaded",
      subtitle: `${originalFileName} stored in private object storage.`,
      metadata: {
        datasetId: result.datasetId,
        filename: originalFileName,
        storageProvider: "r2",
        result: "success",
      },
    }));

    await afterDatasetSave(() => logActivity({
      actor: req.user?._id || req.user?.id,
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
        filename: originalFileName,
        insertedRows: result.insertedRows,
        skippedRows: result.skippedRows,
        result: "success",
      },
    }));

    await afterDatasetSave(() => logActivity({
      actor: req.user?._id || req.user?.id,
      actionType: "dataset_processed",
      title: "Dataset processed",
      subtitle: `${name} processed into ${result.insertedRows} case records.`,
      metadata: {
        datasetId: result.datasetId,
        filename: originalFileName,
        insertedRows: result.insertedRows,
        skippedRows: result.skippedRows,
        result: "success",
      },
    }));

    await afterDatasetSave(() => createNotification({
      type: "dataset_validated",
      title: "Dataset Validated",
      message: `${name} validated successfully${Number.isFinite(result.insertedRows) ? ` (${result.insertedRows} records)` : ""}.`,
      dotColor: "green",
      metadata: {
        datasetId: result.datasetId,
        name,
        insertedRows: result.insertedRows,
      },
    }));

    // Create the durable job before responding so manual refreshes reuse it.
    console.log(
      "Starting monthly district prediction refresh for datasetId:",
      result.datasetId,
    );
    await afterDatasetSave(() => startDatasetPredictionRefresh(result.datasetId));

    return res.status(201).json(result);
  } catch (error) {
    if (uploadedStorageKey) {
      await deleteDatasetObject(uploadedStorageKey).catch((cleanupError) => {
        logRequestError(cleanupError, req, "DATASET_STORAGE_CLEANUP_ERROR");
      });
    }

    if (error?.code === 11000 && error?.keyPattern?.contentHash) {
      return res.status(409).json({
        message: "This exact Excel file has already been uploaded. Renaming it does not create a new dataset.",
      });
    }

    logServerError(error, {
      errorId: req.errorId,
      code: "DATASET_UPLOAD_ERROR",
      method: req.method,
      route: req.baseUrl,
      userId: req.user?.id,
    });
    return res.status(500).json({
      code: "DATASET_SERVICE_ERROR",
      message: "The file could not be processed.",
    });
  }
};

export const handleDatasetUploadError = async (err, req, res, next) => {
  if (!err) return next();
  const reason = err?.code === "LIMIT_FILE_SIZE"
    ? "The Excel workbook must not exceed 25 MB."
    : isSafePublicMessage(err?.message)
      ? err.message
      : "The file could not be processed.";

  return res.status(400).json({ message: reason });
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
    const providerTypeParam = String(req.query.providerType || "")
      .trim()
      .toLowerCase();

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
    if (providerTypeParam) {
      const allowedProviderTypes = new Set([
        "hospital",
        "health_center",
        "cesu",
        "doh",
        "citizen_patient_report",
      ]);
      if (!allowedProviderTypes.has(providerTypeParam)) {
        return res.status(400).json({ message: "Invalid providerType filter." });
      }
      filter.providerType = providerTypeParam;
    }

    const [datasets, total] = await Promise.all([
      Dataset.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "name dataSource dataMode providerType providerName reportingFrequency ingestionMethod originalFileName storageProvider mimeType fileSize recordsCount status coverageStart coverageEnd districtCoverage createdAt uploadedAt errorMessage uploadedBy formatType totalRows insertedRows skippedRows validationErrorCount validationErrors",
        )
        .populate("uploadedBy", "username email role")
        .lean(),
      Dataset.countDocuments(filter),
    ]);

    const cumulativeByDatasetId = await resolveCumulativeDatasetSummaries(datasets);
    const items = datasets.map((entry) => {
      const validationErrors = Array.isArray(entry.validationErrors)
        ? entry.validationErrors
        : [];
      const cumulative = entry.status === "validated" && entry.providerType === "cesu"
        ? cumulativeByDatasetId.get(String(entry._id))
        : null;
      return {
        ...entry,
        errorMessage: isSafePublicMessage(entry.errorMessage)
          ? entry.errorMessage
          : entry.status === "failed"
            ? "The file could not be processed."
            : null,
        analyticalCoverageStart: cumulative?.coverageStart || null,
        analyticalCoverageEnd: cumulative?.coverageEnd || null,
        cumulativeUploadCount: cumulative?.uploadCount || 0,
        validationErrorCount: Number.isFinite(entry.validationErrorCount)
          ? entry.validationErrorCount
          : validationErrors.length,
        validationErrors: sanitizeValidationErrors(validationErrors).slice(0, 5),
      };
    });

    res.json({
      items,
      pagination: paginationMeta({ page, limit, total }),
    });
  } catch (error) {
    logServerError(error, {
      errorId: req.errorId,
      code: "DATASET_LIST_ERROR",
      method: req.method,
      route: req.baseUrl,
      userId: req.user?.id,
    });
    res.status(500).json({ message: "The dataset request could not be completed." });
  }
};

export const downloadDataset = async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id)
      .select("name originalFileName storageProvider storageKey mimeType fileSize filePath")
      .lean();
    if (!dataset)
      return res.status(404).json({ message: "Dataset not found." });

    const filename = dataset.originalFileName || `${dataset.name}.xlsx`;
    if (dataset.storageProvider === "r2" && dataset.storageKey) {
      const object = await getDatasetObject(dataset.storageKey);
      await streamObjectDownload(res, {
        object,
        filename,
        fallbackMimeType: dataset.mimeType,
      });
    } else if (dataset.filePath && fs.existsSync(dataset.filePath)) {
      await new Promise((resolve, reject) => {
        res.download(dataset.filePath, filename, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    } else {
      return res.status(404).json({ message: "Stored dataset file is unavailable." });
    }

    await logActivity({
      actor: req.user?._id || req.user?.id,
      actionType: "dataset_downloaded",
      title: "Original dataset downloaded",
      subtitle: `${filename} was downloaded.`,
      metadata: {
        datasetId: String(dataset._id),
        filename,
        storageProvider: dataset.storageProvider || "local",
        result: "success",
      },
    });
  } catch (error) {
    const notFound = error?.name === "NoSuchKey"
      || error?.$metadata?.httpStatusCode === 404;
    if (!res.headersSent) {
      return res.status(notFound ? 404 : 500).json({
        message: notFound
          ? "Stored dataset file is unavailable."
          : "The dataset could not be downloaded.",
      });
    }
    logRequestError(error, req, "DATASET_DOWNLOAD_STREAM_ERROR");
  }
};

export const downloadOfficialCaseTemplate = async (req, res) => {
  try {
    const object = await getDatasetObject(OFFICIAL_TEMPLATE_STORAGE_KEY);
    await streamObjectDownload(res, {
      object,
      filename: "FoodSafe_Template.xlsx",
      fallbackMimeType: XLSX_MIME_TYPE,
    });
  } catch (err) {
    const notFound = err?.name === "NoSuchKey"
      || err?.$metadata?.httpStatusCode === 404;
    if (!res.headersSent) {
      return res.status(notFound ? 404 : 500).json({
        message: notFound
          ? "Template is not available."
          : "The template could not be downloaded.",
      });
    }
    logRequestError(err, req, "TEMPLATE_DOWNLOAD_STREAM_ERROR");
  }
};
