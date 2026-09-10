// @ts-check

/** Preserve input order and drain active work before propagating errors.
 * @template T, R
 * @param {readonly T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<R>} operation
 * @returns {Promise<R[]>}
 */
export async function boundedForecastMap(items, concurrency, operation) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 2) {
    throw new Error("Forecast concurrency must be 1 or 2.");
  }
  /** @type {R[]} */
  const results = new Array(items.length);
  let cursor = 0;
  let failed = false;
  async function worker() {
    while (!failed && cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await operation(items[index], index);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  }
  const settled = await Promise.allSettled(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  for (const result of settled) if (result.status === "rejected") throw result.reason;
  return results;
}
