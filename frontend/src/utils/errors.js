const CODE_MESSAGES = Object.freeze({
  INTERNAL_ERROR: "The request could not be completed.",
  DASHBOARD_DATA_ERROR: "Dashboard data could not be loaded.",
  DATASET_UPLOAD_ERROR: "The file could not be processed.",
  DATASET_SERVICE_ERROR: "The dataset request could not be completed.",
  REPORT_SERVICE_ERROR: "The report request could not be completed.",
  HEATMAP_SERVICE_ERROR: "Heatmap data is currently unavailable.",
  ANALYTICS_SERVICE_ERROR: "Analytics data could not be loaded.",
  PREDICTION_SERVICE_ERROR: "Prediction data is currently unavailable.",
  USER_SERVICE_ERROR: "User data could not be loaded.",
  NOTIFICATION_SERVICE_ERROR: "Notifications could not be loaded.",
  AUTHENTICATION_ERROR: "The authentication request could not be completed.",
  AUTHORIZATION_ERROR: "You do not have access to this action.",
});

const UNSAFE_MESSAGE = /(?:traceback|modulenotfounderror|mongodb|mongoose|bson|e11000|enoent|eacces|node_modules|prophet|cmdstan|pystan|pandas|numpy|openpyxl|multer|express|jsonwebtoken|bcrypt|aws-sdk|cloudflare|process\.env|node_env|mongo_uri|python_bin|\.m?js:\d+|\.py:\d+|\.dart:\d+|[a-z]:\\|file:\/\/|\/(?:app|home|opt|srv|usr|workspace)\/|\?[a-z0-9_.%[\]-]+=|mongodb(?:\+srv)?:\/\/|access[_-]?token|refresh[_-]?token|secret|authorization|aws_|r2_)/i;

function errorData(error) {
  if (typeof error === "string") return { message: error };
  return error?.response?.data && typeof error.response.data === "object"
    ? error.response.data
    : error;
}

export function getErrorReference(error) {
  const data = errorData(error);
  return data?.errorId || error?.response?.headers?.["x-request-id"] || null;
}

export function getErrorMessage(error, fallback = "The request could not be completed.") {
  const data = errorData(error);
  if (data?.code && CODE_MESSAGES[data.code]) return CODE_MESSAGES[data.code];
  const candidate = typeof data?.message === "string" ? data.message : "";
  if (
    candidate
    && candidate.length <= 500
    && !UNSAFE_MESSAGE.test(candidate)
  ) {
    return candidate;
  }
  return fallback;
}

export function getErrorDisplay(error, fallback) {
  return {
    message: getErrorMessage(error, fallback),
    reference: getErrorReference(error),
  };
}

export function logClientError(context, error) {
  if (import.meta.env.DEV) console.error(context, error);
}
