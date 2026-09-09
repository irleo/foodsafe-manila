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

export function buildAnalyticsCasesViewModel(caseRows = [], coverage = {}) {
  const coveredDistricts = Array.isArray(coverage?.coveredDistricts)
    ? coverage.coveredDistricts
    : [];
  const monthlyTimelineData = buildMonthlyTimelineData(caseRows, coverage);
  const diseaseData = buildDiseaseDistributionComparison(caseRows);
  const districtData = buildDistrictDataFromCases(caseRows, coveredDistricts);
  const districtStats = buildDistrictStatisticsFromCases(caseRows, coveredDistricts);
  const yoy = buildYoYCaseStatsFromCases(caseRows, coverage);
  const diseaseTrend = buildDiseaseTrendByMonth(caseRows, 5, 60, coverage);

  const topDistrict = districtStats[0]?.totalCases > 0
    ? districtStats[0].district
    : "—";
  const topDisease = diseaseData[0]?.disease ?? "—";

  return {
    latestYear: yoy?.thisYear ?? null,
    latestYearCases: yoy?.thisYearCases ?? 0,
    previousYear: yoy?.lastYear ?? null,
    previousYearCases: yoy?.lastYearCases ?? 0,
    topDistrict,
    topDisease,
    districtsCovered: coveredDistricts.length || districtStats.length,
    yoyPct: yoy?.yoyPct ?? null,
    hasComparablePeriod: yoy?.hasComparablePeriod ?? false,
    comparisonIsPartial: yoy?.comparisonIsPartial ?? false,

    diseaseData,
    districtData,
    districtStats,

    diseaseTrendData: diseaseTrend.data,
    diseaseTrendKeys: diseaseTrend.keys,

    monthlyTimelineData,
  };
}
