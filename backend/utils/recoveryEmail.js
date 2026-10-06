// @ts-check
export const RECOVERY_EMAIL_INDEX = "mobileUsersRecoveryEmailUnique";
export const EMAIL_RECOVERY_ACCOUNT_INDEX = "mobileEmailOtpsAccountPurposeUnique";

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
