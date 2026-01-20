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

    const cases = Number(r?.caseCount ?? 1); // <-- key change
    if (!Number.isFinite(cases) || cases <= 0) continue;

    if (!districtMap[district]) {
      districtMap[district] = {
        district,
        totalCases: 0,
        incidents: 0, // still counts rows/month entries
        severityScoreSum: 0, // will be weighted by cases
        highCount: 0,
        moderateCount: 0,
        lowCount: 0,
      };
    }

    const sev = r?.severity || "Low";

    districtMap[district].totalCases += cases;
    districtMap[district].incidents += 1;

    // weight severity by number of cases in the row
    districtMap[district].severityScoreSum += sevWeight(sev) * cases;

    if (sev === "High") districtMap[district].highCount += cases;
    else if (sev === "Moderate") districtMap[district].moderateCount += cases;
    else districtMap[district].lowCount += cases;
  }

  return Object.values(districtMap).map((d) => {
    const avgSeverityScore = d.totalCases ? d.severityScoreSum / d.totalCases : 0;

    let riskLevel = "Low";
    if (avgSeverityScore >= 2.4) riskLevel = "High";
    else if (avgSeverityScore >= 1.7) riskLevel = "Moderate";

    return {
      district: d.district,
      totalCases: d.totalCases,
      incidents: d.incidents,
      avgCasesPerEntry: Number((d.totalCases / d.incidents).toFixed(1)),
      avgSeverityScore: Number(avgSeverityScore.toFixed(2)),
      highCount: d.highCount,
      moderateCount: d.moderateCount,
      lowCount: d.lowCount,
      riskLevel,
    };
  });
}

const percentChange = (current, previous) => {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
};


export function buildYoYCaseStats(reports = []) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const lastYear = thisYear - 1;

  let thisYearCases = 0;
  let lastYearCases = 0;

  for (const r of reports) {
    const dt = new Date(r?.reportedAt);
    if (!dt || Number.isNaN(dt.getTime())) continue;

    const cases = Number(r?.caseCount ?? 1);
    if (!Number.isFinite(cases) || cases < 0) continue;

    const y = dt.getFullYear();
    if (y === thisYear) thisYearCases += cases;
    else if (y === lastYear) lastYearCases += cases;
  }

  const yoyPct = percentChange(thisYearCases, lastYearCases);

  return {
    thisYear,
    lastYear,
    thisYearCases,
    lastYearCases,
    yoyPct: Number(yoyPct.toFixed(1)),
  };
}
