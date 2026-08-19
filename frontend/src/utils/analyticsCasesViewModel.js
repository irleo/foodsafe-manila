import {
  buildMonthlyTimelineData,
  buildDiseaseDistributionComparison,
  buildDistrictDataFromCases,
  buildDiseaseTrendByMonth,
} from "./analyticsCaseBuilders";

import {
  buildDistrictStatisticsFromCases,
  buildYoYCaseStatsFromCases,
} from "./statisticsCaseBuilders";

export function buildAnalyticsCasesViewModel(caseRows = []) {
  const monthlyTimelineData = buildMonthlyTimelineData(caseRows);
  const diseaseData = buildDiseaseDistributionComparison(caseRows);
  const districtData = buildDistrictDataFromCases(caseRows);
  const districtStats = buildDistrictStatisticsFromCases(caseRows);
  const yoy = buildYoYCaseStatsFromCases(caseRows);
  const diseaseTrend = buildDiseaseTrendByMonth(caseRows, 5, 60);

  const topDistrict = districtStats[0]?.district ?? "—";
  const topDisease = diseaseData[0]?.disease ?? "—";

  return {
    latestYear: yoy?.thisYear ?? null,
    latestYearCases: yoy?.thisYearCases ?? 0,
    previousYear: yoy?.lastYear ?? null,
    topDistrict,
    topDisease,
    districtsCovered: districtStats.length,
    yoyPct: yoy?.yoyPct ?? null,

    diseaseData,
    districtData,
    districtStats,

    diseaseTrendData: diseaseTrend.data,
    diseaseTrendKeys: diseaseTrend.keys,

    monthlyTimelineData,

    // dailyTimelineData: [], // not supported
    // monthlyTrendData: [], // not supported
    // severityData: [], // not supported
  };
}
