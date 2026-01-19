import "./analyticsData.js"

export function buildDistrictStatistics(reports) {
  const districtMap = {};

  reports.forEach((r) => {
    const district = r.location;

    if (!districtMap[district]) {
      districtMap[district] = {
        district,
        totalCases: 0,
        incidents: 0,
      };
    }

    districtMap[district].totalCases += 1; // later: r.caseCount
    districtMap[district].incidents += 1;
  });

  return Object.values(districtMap).map((d) => {
    const avg = d.totalCases / d.incidents;

    let riskLevel = "Low";
    if (avg >= 25) riskLevel = "High";
    else if (avg >= 15) riskLevel = "Moderate";

    return {
      district: d.district,
      totalCases: d.totalCases,
      incidents: d.incidents,
      avgCases: Number(avg.toFixed(1)),
      riskLevel,
    };
  });
}
