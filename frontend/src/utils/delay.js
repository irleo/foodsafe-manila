/**
 * Pause execution for a given number of milliseconds
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function delay(ms = 500) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
