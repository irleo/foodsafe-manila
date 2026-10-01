/** @param {unknown} value @param {number} limit @returns {boolean} */
export const isRequiredText = (value, limit = 120) => typeof value === "string" && value.trim().length > 0 && value.length <= limit;
/** @param {unknown} value @returns {boolean} */
export const isValidEmail = (value) => isRequiredText(value, 254) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
