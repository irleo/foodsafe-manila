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
import { createNotification } from "../services/notificationService.js";
import { resolveCumulativeDatasetContext } from "../services/cumulativeOfficialCaseService.js";
import {
  isSafePublicMessage,
  sanitizeValidationErrors,
} from "../middleware/errorHandler.js";
import { logServerError } from "../utils/serverLogger.js";
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
  let job;
  try {
    job = await PredictionRun.create({
      model: "prophet",
      granularity: PREDICTION_GRANULARITY,
      datasetScope: datasetId,
      basisDatasetId: datasetId,
      trigger: "official_upload",
      status: "running",
      startedAt: new Date(),
    });
  } catch (error) {
    if (error?.code === 11000) {
      console.log(
        "Prediction refresh already active for datasetId:",
        String(datasetId),
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
    datasetId,
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
  let dataset = null;
  let uploadedStorageKey = "";

  try {
    const { name } = req.body;
    // CESU is the sole authoritative uploader. Provider metadata is assigned
    // server-side so a custom client cannot introduce another official source.
    const providerType = OFFICIAL_PROVIDER_TYPE;
    const providerName = OFFICIAL_PROVIDER_NAME;
    const reportingFrequency = String(req.body.reportingFrequency || "weekly")
      .trim()
      .toLowerCase();
    let districtCoverage = [];
    try {
      districtCoverage = req.body.districtCoverage
        ? JSON.parse(req.body.districtCoverage)
        : [];
    } catch {
      return res.status(400).json({ message: "District coverage must be valid JSON." });
    }
    if (!Array.isArray(districtCoverage)) {
      return res.status(400).json({ message: "District coverage must be a list." });
    }
    if (!req.file)
      return res.status(400).json({ message: "No file uploaded." });
    if (!name) {
      return res.status(400).json({ message: "Name is required." });
    }
    if (!["weekly", "monthly"].includes(reportingFrequency)) {
      return res.status(400).json({ message: "Reporting frequency must be weekly or monthly." });
    }

    const originalFileName = path.basename(req.file.originalname);
    const ext = path.extname(originalFileName).toLowerCase();

    if (ext !== ".xlsx" && ext !== ".xls") {
      return res.status(400).json({
        message: "Unsupported file type. Upload an Excel workbook (.xlsx/.xls).",
      });
    }

    const contentHash = calculateFileSha256(req.file.buffer);
    const duplicate = await Dataset.findOne({ contentHash })
      .select("name originalFileName status createdAt")
      .lean();
    if (duplicate) {
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
        originalFileName,
        storageProvider: "none",
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
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
        actor: req.user?._id || req.user?.id,
        actionType: "dataset_failed",
        title: "Dataset validation failed",
        subtitle: `${name} failed validation.`,
        metadata: {
          datasetId: String(dataset._id),
          name,
          filename: originalFileName,
          reason: result?.reason || "Validation failed.",
          result: "failed",
        },
      });
      return res.status(400).json({ ...result, datasetId: String(dataset._id) });
    }
    // The database now owns the R2 object reference; later notification/audit
    // failures must not remove a successfully persisted original workbook.
    uploadedStorageKey = "";

    await logActivity({
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
    });

    await logActivity({
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
    });

    await logActivity({
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

    // Create the durable job before responding so manual refreshes reuse it.
    console.log(
      "Starting monthly district prediction refresh for datasetId:",
      result.datasetId,
    );
    await startDatasetPredictionRefresh(result.datasetId);

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

    if (dataset) {
      dataset.status = "failed";
      dataset.errorMessage = "The file could not be processed.";
      await dataset.save().catch((saveError) => {
        logRequestError(saveError, req, "DATASET_STATUS_UPDATE_ERROR");
      });
      await createNotification({
        type: "dataset_failed",
        title: "Dataset Validation Failed",
        message: `${dataset.name}: ${dataset.errorMessage}`,
        dotColor: "red",
        metadata: { datasetId: String(dataset._id), name: dataset.name },
      });
      await logActivity({
        actor: req.user?._id || req.user?.id,
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

  try {
    const name = String(req.body?.name || "").trim() || "Unnamed upload";
    const originalFileName =
      req.file?.originalname || String(req.body?.originalFileName || "unknown");
    const mimeType = req.file?.mimetype || String(req.body?.mimeType || "");
    const failed = await Dataset.create({
      name,
      dataSource: "official_upload",
      coverageStart: new Date(),
      coverageEnd: new Date(),
      originalFileName,
      storageProvider: "none",
      mimeType,
      fileSize: req.file?.size || 0,
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
      actor: req.user?._id || req.user?.id,
      actionType: "dataset_failed",
      title: "Dataset upload rejected",
      subtitle: `${name} was rejected during upload.`,
      metadata: {
        datasetId: String(failed._id),
        name,
        filename: originalFileName,
        reason,
        result: "failed",
      },
    });
  } catch (saveErr) {
    logRequestError(saveErr, req, "DATASET_REJECTION_PERSIST_ERROR");
  }

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

    const items = await Promise.all(datasets.map(async (entry) => {
      const validationErrors = Array.isArray(entry.validationErrors)
        ? entry.validationErrors
        : [];
      const cumulative = entry.status === "validated" && entry.providerType === "cesu"
        ? await resolveCumulativeDatasetContext(entry._id)
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
    }));

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
