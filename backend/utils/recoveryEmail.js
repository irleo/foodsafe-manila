// @ts-check
export const RECOVERY_EMAIL_INDEX = "mobileUsersRecoveryEmailUnique";
export const EMAIL_UNAVAILABLE = {
  code: "RECOVERY_EMAIL_UNAVAILABLE",
  message: "This recovery email cannot be used. Use another address.",
};

/** @param {unknown} value @returns {string} */
export function normalizeRecoveryEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** @param {unknown} value @param {boolean} [required] */
export function isValidRecoveryEmail(value, required = false) {
  if (value != null && typeof value !== "string") return false;
  const email = normalizeRecoveryEmail(value);
  if (!email) return !required;
  return email.length <= 254 && email.split("@")[0].length <= 64
    && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email)
    && !email.startsWith(".") && !email.includes("..") && !email.includes(".@");
}

/** @param {unknown} error */
export function isDuplicateRecoveryEmail(error) {
  const value = /** @type {{code?: number, keyPattern?: Record<string, unknown>, keyValue?: Record<string, unknown>, message?: string}} */ (error);
  return value?.code === 11000 && (value.keyPattern?.email === 1
    || Object.hasOwn(value.keyValue || {}, "email")
    || value.message?.includes(RECOVERY_EMAIL_INDEX));
}
