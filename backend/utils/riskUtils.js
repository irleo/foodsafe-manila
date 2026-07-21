export function computeRiskScore(caseCount) {
  const cases = Math.max(0, Number(caseCount ?? 0));
  if (cases <= 0) return 0;
  return Math.min(100, Math.round((Math.min(cases, 31) / 31) * 100));
}

export function riskLevelFromCases(caseCount) {
  const cases = Math.max(0, Number(caseCount ?? 0));
  if (cases >= 31) return "critical";
  if (cases >= 16) return "high";
  if (cases >= 6) return "medium";
  return "low";
}

export function riskLabel(level) {
  if (level === "critical") return "Critical Risk";
  if (level === "high") return "High Risk";
  if (level === "medium") return "Medium Risk";
  return "Low Risk";
}

export function computeRiskAnalysis(caseCount) {
  const cases = Math.max(0, Number(caseCount ?? 0));
  const level = riskLevelFromCases(cases);
  return {
    caseCount: cases,
    riskScore: computeRiskScore(cases),
    riskLevel: level,
    risk: riskLabel(level).replace(" Risk", ""),
    riskLabel: riskLabel(level),
  };
}

export function monthsAgoDate(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}
