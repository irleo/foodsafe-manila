import { randomBytes } from "crypto";
import AppError from "../errors/AppError.js";
import {
  defaultCodeForStatus,
  ErrorCodes,
  moduleErrorForPath,
} from "../errors/errorCodes.js";
import { logServerError } from "../utils/serverLogger.js";

const UNSAFE_MESSAGE = /(?:traceback|modulenotfounderror|mongodb|mongoose|bson|e11000|enoent|eacces|node_modules|prophet|cmdstan|pystan|pandas|numpy|openpyxl|multer|express|jsonwebtoken|bcrypt|aws-sdk|cloudflare|process\.env|node_env|mongo_uri|python_bin|\.m?js:\d+|\.py:\d+|\.dart:\d+|[a-z]:\\|file:\/\/|\/(?:app|home|opt|srv|usr|workspace)\/|\?[a-z0-9_.%[\]-]+=|mongodb(?:\+srv)?:\/\/|access[_-]?token|refresh[_-]?token|secret|authorization|aws_|r2_)/i;
const SAFE_DETAIL_KEYS = new Set([
  "validationErrors",
  "validationErrorCount",
  "totalRows",
  "insertedRows",
  "skippedRows",
  "formatType",
  "datasetId",
  "retryAfter",
  "retryAfterSeconds",
]);

function requestPath(req) {
  return req.originalUrl?.split("?")[0] || req.baseUrl || req.path || "";
}

function errorId() {
  return `ERR-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export function isSafePublicMessage(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 500
    && !UNSAFE_MESSAGE.test(value);
}

export function sanitizeValidationErrors(value) {
  if (!Array.isArray(value)) return undefined;
  const safeLabel = (label) => {
    const normalized = String(label || "").slice(0, 100);
    return isSafePublicMessage(normalized) ? normalized : undefined;
  };
  return value.slice(0, 100).map((issue) => ({
    ...(safeLabel(issue?.sheet) ? { sheet: safeLabel(issue.sheet) } : {}),
    ...(Number.isInteger(issue?.row) ? { row: issue.row } : {}),
    ...(safeLabel(issue?.column) ? { column: safeLabel(issue.column) } : {}),
    ...(safeLabel(issue?.field) ? { field: safeLabel(issue.field) } : {}),
    message: isSafePublicMessage(issue?.message)
      ? issue.message
      : "This row could not be validated.",
  }));
}

function sanitizeSafeDetail(key, value) {
  if (key === "validationErrors") return sanitizeValidationErrors(value);
  if (["validationErrorCount", "totalRows", "insertedRows", "skippedRows", "retryAfter", "retryAfterSeconds"].includes(key)) {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  if (["formatType", "datasetId"].includes(key)) {
    if (typeof value !== "string") return undefined;
    const normalized = value.slice(0, 100);
    return isSafePublicMessage(normalized) ? normalized : undefined;
  }
  return undefined;
}

export function requestContext(req, res, next) {
  req.errorId = errorId();
  res.setHeader("X-Request-ID", req.errorId);
  next();
}

export function standardizeErrorResponses(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 400) return originalJson(body);

    const source = body && typeof body === "object" ? body : {};
    const path = requestPath(req);
    const moduleError = moduleErrorForPath(path);
    const status = res.statusCode;
    const message = status >= 500
      ? moduleError.message
      : isSafePublicMessage(source.message)
        ? source.message
        : "The request could not be completed.";
    const response = {
      success: false,
      code: status >= 500
        ? moduleError.code
        : isSafePublicMessage(source.code)
          ? source.code
          : defaultCodeForStatus(status, path),
      message,
    };

    if (status >= 500) response.errorId = req.errorId;
    for (const key of SAFE_DETAIL_KEYS) {
      if (!(key in source)) continue;
      const detail = sanitizeSafeDetail(key, source[key]);
      if (detail !== undefined) response[key] = detail;
    }
    return originalJson(response);
  };
  next();
}

export function notFoundHandler(req, res) {
  return res.status(404).json({
    code: ErrorCodes.ROUTE_NOT_FOUND,
    message: "Route not found.",
  });
}

function statusForError(error) {
  const candidate = Number(error?.status || error?.statusCode);
  if (Number.isInteger(candidate) && candidate >= 400 && candidate <= 599) {
    return candidate;
  }
  if (error?.name === "ValidationError" || error?.name === "CastError") return 400;
  if (error?.code === 11000) return 409;
  if (error?.name === "JsonWebTokenError" || error?.name === "TokenExpiredError") return 401;
  return 500;
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status = statusForError(error);
  const path = requestPath(req);
  const moduleError = moduleErrorForPath(path);
  const operational = error instanceof AppError && error.isOperational;
  const message = operational && status < 500 && isSafePublicMessage(error.message)
    ? error.message
    : status >= 500
      ? moduleError.message
      : "The request could not be completed.";
  const code = operational ? error.code : defaultCodeForStatus(status, path);

  logServerError(error, {
    errorId: req.errorId,
    code,
    method: req.method,
    route: path,
    userId: req.user?.id || req.user?._id,
  });

  return res.status(status).json({ code, message });
}
