import {
  buildYearlyTimelineData,
  buildDiseaseData,
  buildDistrictDataFromCases,
  buildDiseaseTrendByYear,
} from "./analyticsCaseBuilders";

import {
  buildDistrictStatisticsFromCases,
  buildYoYCaseStatsFromCases,
  buildRiskLevelDonutDataFromDistrictStats,
} from "./statisticsCaseBuilders";

export function buildAnalyticsCasesViewModel(caseRows = []) {
  const yearlyTimelineData = buildYearlyTimelineData(caseRows);
  const diseaseData = buildDiseaseData(caseRows);
  const districtData = buildDistrictDataFromCases(caseRows);
  const districtStats = buildDistrictStatisticsFromCases(caseRows);
  const riskLevelData = buildRiskLevelDonutDataFromDistrictStats(districtStats);
  const yoy = buildYoYCaseStatsFromCases(caseRows);
  const diseaseTrend = buildDiseaseTrendByYear(caseRows, 5, 5);

  const totalCases = caseRows.reduce(
    (sum, r) => sum + (Number(r?.cases) || 0),
    0,
  );

  const thisYearCases = (() => {
    const currentYear = new Date().getFullYear();
    return caseRows
      .filter((r) => Number(r?.year) === currentYear)
      .reduce((sum, r) => sum + (Number(r?.cases) || 0), 0);
  })();

  const topDistrict = districtStats[0]?.district ?? "—";
  const topDisease = diseaseData[0]?.disease ?? "—";

  return {
    totalCases,
    thisYearCases,
    topDistrict,
    topDisease,
    riskLevelData,
    districtsCovered: districtStats.length,
    yoyPct: yoy?.yoyPct ?? null,

    diseaseData,
    districtData,
    districtStats,

    diseaseTrendData: diseaseTrend.data,
    diseaseTrendKeys: diseaseTrend.keys,

    yearlyTimelineData,

    // dailyTimelineData: [], // not supported
    // monthlyTrendData: [], // not supported
    // severityData: [], // not supported
  };
}
