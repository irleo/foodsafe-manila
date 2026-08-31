export function formatThresholdValue(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : fallback;
}
