// @ts-check
/**
 * Compare unrounded MAEs. A tie is explicit and never selects a fallback.
 * @param {number | null | undefined} prophetMae
 * @param {number | null | undefined} benchmarkMae
 * @returns {"prophet" | "seasonal_naive" | "tie" | null}
 */
export function historicalModelWinner(prophetMae, benchmarkMae) {
  if (typeof prophetMae !== "number" || typeof benchmarkMae !== "number"
    || !Number.isFinite(prophetMae) || !Number.isFinite(benchmarkMae)
    || prophetMae < 0 || benchmarkMae < 0) return null;
  if (prophetMae === benchmarkMae) return "tie";
  return prophetMae < benchmarkMae ? "prophet" : "seasonal_naive";
}
