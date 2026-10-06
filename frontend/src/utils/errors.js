const CODE_MESSAGES = Object.freeze({
  INTERNAL_ERROR: "We couldn't complete this action. Please try again later.",
  DASHBOARD_DATA_ERROR: "We couldn't load the dashboard. Please refresh and try again.",
  DATASET_UPLOAD_ERROR: "We couldn't process this file. Check the upload list before trying again.",
  DATASET_SERVICE_ERROR: "We couldn't load the uploaded data. Please refresh and try again.",
  REPORT_SERVICE_ERROR: "We couldn't load the reports. Please refresh and try again.",
  HEATMAP_SERVICE_ERROR: "We couldn't load the risk map. Please refresh and try again.",
  ANALYTICS_SERVICE_ERROR: "We couldn't load the health insights. Please refresh and try again.",
  PREDICTION_SERVICE_ERROR: "We couldn't load the forecasts. Please refresh and try again.",
  USER_SERVICE_ERROR: "We couldn't load the account information. Please refresh and try again.",
  NOTIFICATION_SERVICE_ERROR: "We couldn't load the notifications. Please refresh and try again.",
  AUTHENTICATION_ERROR: "We couldn't complete your account request. Please try again later.",
  AUTHORIZATION_ERROR: "You don't have permission to do this. Please contact the test administrator.",
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
  const reference = data?.errorId || error?.response?.headers?.["x-request-id"];
  return typeof reference === "string" && /^ERR-[A-F0-9]{8}$/.test(reference) ? reference : null;
}

export function getErrorMessage(error, fallback) {
  const data = errorData(error);
  if (error?.code === "ERR_NETWORK") return "Could not connect to the server. Check your connection and try again.";
  if (["ECONNABORTED", "ETIMEDOUT"].includes(error?.code)) return "The server took too long to respond. Please try again.";
  const candidate = typeof data?.message === "string" ? data.message : "";
  if (["Failed to fetch", "NetworkError when attempting to fetch resource."].includes(candidate)) return "Could not connect to the server. Check your connection and try again.";
  if (
    candidate
    && candidate.length <= 500
    && !UNSAFE_MESSAGE.test(candidate)
    && !/^(?:Request failed|Update failed|Failed to .+|User data could not be loaded\.|The request could not be completed\.|The authentication request could not be completed\.)$/.test(candidate)
  ) {
    return candidate;
  }
  const status = error?.response?.status;
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You don't have permission to do this. Please contact the test administrator.";
  if (status === 429) return "You've made too many attempts. Please wait before trying again.";
  if (status === 413) return "This file is too large. Choose a smaller file and try again.";
  if (typeof data?.code === "string" && Object.hasOwn(CODE_MESSAGES, data.code)) return fallback || CODE_MESSAGES[data.code];
  return fallback || "We couldn't complete this action. Please try again later.";
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
