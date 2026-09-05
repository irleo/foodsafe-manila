export const ErrorCodes = Object.freeze({
  INTERNAL_ERROR: "INTERNAL_ERROR",
  ROUTE_NOT_FOUND: "ROUTE_NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR: "AUTHORIZATION_ERROR",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  DASHBOARD_ERROR: "DASHBOARD_DATA_ERROR",
  DATASET_UPLOAD_ERROR: "DATASET_UPLOAD_ERROR",
  DATASET_ERROR: "DATASET_SERVICE_ERROR",
  REPORT_ERROR: "REPORT_SERVICE_ERROR",
  HEATMAP_ERROR: "HEATMAP_SERVICE_ERROR",
  ANALYTICS_ERROR: "ANALYTICS_SERVICE_ERROR",
  PREDICTION_ERROR: "PREDICTION_SERVICE_ERROR",
  USER_ERROR: "USER_SERVICE_ERROR",
  NOTIFICATION_ERROR: "NOTIFICATION_SERVICE_ERROR",
});

const MODULE_ERRORS = Object.freeze([
  { prefix: "/api/dashboard", code: ErrorCodes.DASHBOARD_ERROR, message: "Dashboard data could not be loaded." },
  { prefix: "/api/datasets/upload", code: ErrorCodes.DATASET_UPLOAD_ERROR, message: "The file could not be processed." },
  { prefix: "/api/risk", code: ErrorCodes.HEATMAP_ERROR, message: "Heatmap data is currently unavailable." },
  { prefix: "/api/official-cases", code: ErrorCodes.ANALYTICS_ERROR, message: "Analytics data could not be loaded." },
  { prefix: "/api/activity", code: ErrorCodes.DASHBOARD_ERROR, message: "Dashboard data could not be loaded." },
  { prefix: "/api/cases", code: ErrorCodes.ANALYTICS_ERROR, message: "Case data could not be loaded." },
  { prefix: "/api/thresholds", code: ErrorCodes.ANALYTICS_ERROR, message: "Threshold data is currently unavailable." },
  { prefix: "/api/analytics", code: ErrorCodes.ANALYTICS_ERROR, message: "Analytics data could not be loaded." },
  { prefix: "/api/heatmap", code: ErrorCodes.HEATMAP_ERROR, message: "Heatmap data is currently unavailable." },
  { prefix: "/api/predictions", code: ErrorCodes.PREDICTION_ERROR, message: "Prediction data is currently unavailable." },
  { prefix: "/api/datasets", code: ErrorCodes.DATASET_ERROR, message: "The dataset request could not be completed." },
  { prefix: "/api/reports", code: ErrorCodes.REPORT_ERROR, message: "The report request could not be completed." },
  { prefix: "/api/users", code: ErrorCodes.USER_ERROR, message: "User data could not be loaded." },
  { prefix: "/api/notifications", code: ErrorCodes.NOTIFICATION_ERROR, message: "Notifications could not be loaded." },
  { prefix: "/api/auth", code: ErrorCodes.AUTHENTICATION_ERROR, message: "The authentication request could not be completed." },
  { prefix: "/api/mobile", code: ErrorCodes.DASHBOARD_ERROR, message: "Dashboard data could not be loaded." },
]);

export function moduleErrorForPath(path = "") {
  return MODULE_ERRORS.find(({ prefix }) => path.startsWith(prefix)) || {
    code: ErrorCodes.INTERNAL_ERROR,
    message: "The request could not be completed.",
  };
}

export function defaultCodeForStatus(status, path = "") {
  if (status >= 500) return moduleErrorForPath(path).code;
  if (status === 404) return ErrorCodes.ROUTE_NOT_FOUND;
  if (status === 409) return ErrorCodes.CONFLICT;
  if (status === 429) return ErrorCodes.RATE_LIMITED;
  if (status === 401) return ErrorCodes.AUTHENTICATION_ERROR;
  if (status === 403) return ErrorCodes.AUTHORIZATION_ERROR;
  return ErrorCodes.VALIDATION_ERROR;
}
