// Keep this policy identical in the frontend and backend name validators.
export const NAME_MESSAGE = "Use 1-80 characters: letters, spaces, apostrophes, or hyphens; start and end with a letter.";
/** @param {unknown} value @returns {string} */
export const normalizeName = (value) => typeof value === "string" ? value.normalize("NFC").trim().replace(/ +/g, " ") : "";
/** Allows incomplete names while typing; final validation checks separators. @param {string} value @returns {boolean} */
export const hasSupportedNameCharacters = (value) => /^[\p{L}\p{M} '\u2019-]*$/u.test(value);
/** @param {unknown} value @returns {boolean} */
export const isValidName = (value) => typeof value === "string" && hasSupportedNameCharacters(value) && value.length <= 80 && /^[\p{L}][\p{L}\p{M}]*(?:[ '\u2019-][\p{L}][\p{L}\p{M}]*)*$/u.test(normalizeName(value));
