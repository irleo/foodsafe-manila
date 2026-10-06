// @ts-check
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
  { prefix: "/api/insights/predictions", code: ErrorCodes.PREDICTION_ERROR, message: "Prediction data is currently unavailable." },
  { prefix: "/api/insights/analytics", code: ErrorCodes.ANALYTICS_ERROR, message: "Analytics data could not be loaded." },
  { prefix: "/api/mobile", code: ErrorCodes.DASHBOARD_ERROR, message: "Dashboard data could not be loaded." },
]);

/** @param {string} path @param {string} method @returns {{code: string, message: string}} */
export function moduleErrorForPath(path = "", method = "GET") {
  const base = MODULE_ERRORS.find(({ prefix }) => path === prefix || path.startsWith(`${prefix}/`)) || {
    code: ErrorCodes.INTERNAL_ERROR,
    message: "We couldn't complete this action. Please try again later.",
  };
  const write = !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
  let message;
  if (path.startsWith("/api/auth")) {
    if (/\/policies(?:\/|$)/.test(path)) {
      message = write ? "We couldn't save your policy acknowledgement. Please try again." : "We couldn't load the account policies. Please try again.";
    } else if (/\/otp\/verify$|\/verify-otp$/.test(path)) {
      message = "We couldn't check your verification code. Please try again before it expires.";
    } else if (/\/otp\/send$|\/send-otp$|\/forgot-password$/.test(path)) {
      message = "We couldn't send a verification code right now. Please wait a moment and try again.";
    } else if (/\/reset-password(?:\/complete)?$/.test(path)) {
      message = "We couldn't change your password. Please try again; request a new code if yours has expired.";
    } else if (/\/register$/.test(path)) {
      message = "We couldn't create your account. Please try again later.";
    } else if (/\/login$/.test(path)) {
      message = "Sign-in is temporarily unavailable. Please try again later.";
    } else if (/\/refresh$/.test(path)) {
      message = "We couldn't reconnect your session. Please try again shortly.";
    } else if (/\/logout$/.test(path)) {
      message = "We couldn't finish signing you out. Please try again.";
    } else if (/\/user\/(?:exists|email-exists)$/.test(path)) {
      message = "We couldn't check those contact details. Please try again later.";
    } else {
      message = "We couldn't complete your account request. Please try again later.";
    }
  } else if (path.startsWith("/api/users")) {
    message = write ? "We couldn't save your account changes. Please try again." : "We couldn't load your account information. Please refresh and try again.";
    if (method.toUpperCase() === "DELETE") message = "We couldn't remove this account. Please try again.";
    if (write && /\/(?:status|access)$/.test(path)) message = "We couldn't save this account's access settings. Please try again.";
  } else if (path.startsWith("/api/reports")) {
    message = write ? "We couldn't save your report. Check your report history before trying again." : "We couldn't load your reports. Please refresh and try again.";
    if (path.endsWith("/last")) message = "We couldn't check when you last submitted a report. Please try again.";
    if (path.endsWith("/audit")) message = "We couldn't load this report's activity history. Please try again.";
    if (write && /\/(?:investigation|mark-suspected|rule-out|validation)$/.test(path)) message = "We couldn't save the report's review status. Please refresh the report before trying again.";
  } else if (path.startsWith("/api/notifications")) {
    message = write ? "We couldn't update your notifications. Please try again." : "We couldn't load your notifications. Please refresh and try again.";
  } else if (path.startsWith("/api/predictions") || path.startsWith("/api/insights/predictions")) {
    message = write ? "We couldn't start the forecast refresh. Please try again later." : "We couldn't load the forecasts. Please refresh and try again.";
  } else if (path.startsWith("/api/datasets")) {
    message = write ? "We couldn't process this file. Check the upload list before trying again." : "We couldn't load the uploaded data. Please refresh and try again.";
    if (path.endsWith("/validate")) message = "We couldn't check this file. Please try validation again.";
    if (path.endsWith("/download") || path.includes("/template/")) message = "We couldn't download this file. Please try again.";
  } else if (path.startsWith("/api/thresholds")) {
    message = write ? "We couldn't save the alert settings. Please try again." : "We couldn't load the alert settings. Please refresh and try again.";
  } else if (path.startsWith("/api/insights/analytics")) {
    message = "We couldn't load the health insights. Please refresh and try again.";
  }
  return { ...base, message: message || (base.code === ErrorCodes.INTERNAL_ERROR ? base.message : `${base.message} Please try again later.`) };
}

// Only fixed, reviewed operational messages may survive a server failure.
/** @param {unknown} code @param {string} path @param {number} status */
export function publicOperationalFailure(code, path, status) {
  if (status !== 503) return null;
  if (code === "RECOVERY_EMAIL_SETUP_REQUIRED") {
    const saving = path.startsWith("/api/users") || path.endsWith("/register");
    return { code, message: saving
      ? "Recovery email changes are temporarily unavailable. Please try again later."
      : "Email recovery is temporarily unavailable. Use your phone number to recover your account." };
  }
  if (code === "POLICY_CHECK_UNAVAILABLE") return { code, message: "We couldn't check your policy acknowledgement. Please try again shortly." };
  return null;
}

/** @param {number} status */
export function defaultMessageForStatus(status) {
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You don't have permission to do this. Please contact the test administrator if you need access.";
  if (status === 404) return "This item is no longer available. Please refresh and try again.";
  if (status === 409) return "Your information changed or is already in use. Please refresh and check your details.";
  if (status === 429) return "You've made too many attempts. Please wait before trying again.";
  if (status === 413) return "This file is too large. Choose a smaller file and try again.";
  return "Please check the information you entered and try again.";
}

/** @param {number} status @param {string} path */
export function defaultCodeForStatus(status, path = "") {
  if (status >= 500) return moduleErrorForPath(path).code;
  if (status === 404) return ErrorCodes.ROUTE_NOT_FOUND;
  if (status === 409) return ErrorCodes.CONFLICT;
  if (status === 429) return ErrorCodes.RATE_LIMITED;
  if (status === 401) return ErrorCodes.AUTHENTICATION_ERROR;
  if (status === 403) return ErrorCodes.AUTHORIZATION_ERROR;
  return ErrorCodes.VALIDATION_ERROR;
}
