export function formatCoverageDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-PH", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatCoverageRange(dataset) {
  const start = formatCoverageDate(
    dataset?.analyticalCoverageStart || dataset?.coverageStart,
  );
  const end = formatCoverageDate(
    dataset?.analyticalCoverageEnd || dataset?.coverageEnd,
  );
  return start && end ? `${start}–${end}` : null;
}
