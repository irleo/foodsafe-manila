/**
 * Build district-level statistics for tables & summaries
 * @param {Array} reports
 */

const sevWeight = (s) => {
  if (s === "High") return 3;
  if (s === "Moderate") return 2;
  return 1; // Low
};

export function buildDistrictStatistics(reports = []) {
  const districtMap = {};

  for (const r of reports) {
    const district = r?.location?.district || r?.location;
    if (!district) continue;

    if (!districtMap[district]) {
      districtMap[district] = {
        district,
        totalCases: 0,
        incidents: 0,
        severityScoreSum: 0,
        highCount: 0,
        moderateCount: 0,
        lowCount: 0,
      };
    }

    const sev = r?.severity || "Low";

    districtMap[district].totalCases += 1;
    districtMap[district].incidents += 1;

    districtMap[district].severityScoreSum += sevWeight(sev);

    if (sev === "High") districtMap[district].highCount += 1;
    else if (sev === "Moderate") districtMap[district].moderateCount += 1;
    else districtMap[district].lowCount += 1;
  }

  return Object.values(districtMap).map((d) => {
    const avgSeverityScore = d.incidents ? d.severityScoreSum / d.incidents : 0;

    // Tune these thresholds how you want
    let riskLevel = "Low";
    if (avgSeverityScore >= 2.4) riskLevel = "High";
    else if (avgSeverityScore >= 1.7) riskLevel = "Moderate";

    return {
      district: d.district,
      totalCases: d.totalCases,
      incidents: d.incidents,
      avgCases: Number((d.totalCases / d.incidents).toFixed(1)), // will be 1.0 in your current model
      avgSeverityScore: Number(avgSeverityScore.toFixed(2)),
      highCount: d.highCount,
      moderateCount: d.moderateCount,
      lowCount: d.lowCount,
      riskLevel,
    };
  });
}
