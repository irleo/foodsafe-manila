export function computeRiskScore(officialCases, suspectedCases) {
  const raw = officialCases * 1.0 + suspectedCases * 0.65;
  if (raw <= 0) return 0;
  const score = Math.min(100, Math.round((Math.log1p(raw) / Math.log1p(50)) * 100));
  return score;
}

export function riskLevelFromScore(score) {
  if (score >= 70) return "high";
  if (score >= 35) return "moderate";
  return "low";
}

export function riskLabel(level) {
  if (level === "high") return "High Risk";
  if (level === "moderate") return "Moderate Risk";
  return "Low Risk";
}

export function monthsAgoDate(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}
