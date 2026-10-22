/** @param {unknown} value @param {number} limit @returns {boolean} */
export const isRequiredText = (value, limit = 120) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= limit;

/**
 * Plain-text policy for structured organization/title fields.
 * Allows letters, combining marks, numbers, spaces, and common punctuation,
 * while rejecting HTML markup characters and control characters.
 */
const STRUCTURED_TEXT_PATTERN = /^[\p{L}\p{M}\p{N} .,'’&()\/-]+$/u;

export const STRUCTURED_TEXT_MESSAGE =
  "Use letters, numbers, spaces, and common punctuation only (.-,'’&()/).";

/** @param {unknown} value @param {number} limit @returns {boolean} */
export const isValidStructuredText = (value, limit = 120) => {
  if (!isRequiredText(value, limit)) return false;
  return STRUCTURED_TEXT_PATTERN.test(value.trim());
};

/** @param {unknown} value @returns {boolean} */
export const isValidEmail = (value) =>
  isRequiredText(value, 254) &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
