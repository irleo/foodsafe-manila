import {
  buildMonthlyTrendData,
  buildDailyTimelineData,
  buildIllnessData,
  buildSeverityData,
  buildDistrictData,
} from "./analyticsBuilders";

import { buildDistrictStatistics } from "./statisticsBuilders";

export function buildAnalyticsViewModel(reports) {
  const dailyTimelineData = buildDailyTimelineData(reports);
  const monthlyTrendData = buildMonthlyTrendData(reports);
  const illnessData = buildIllnessData(reports);
  const severityData = buildSeverityData(reports);
  const districtData = buildDistrictData(reports);
  const districtStats = buildDistrictStatistics(reports);

  const totalCases = reports.length;

  const thisYearCases = (() => {
    const currentYear = new Date().getFullYear();

    return reports.filter((r) => {
      const d = new Date(r.reportedAt || r.date);
      return d.getFullYear() === currentYear;
    }).length;
  })();

  const topDistrict = (() => {
    if (!districtStats.length) return "—";
    return [...districtStats].sort((a, b) => b.totalCases - a.totalCases)[0]
      .district;
  })();

  const topIllness = (() => {
    if (!illnessData.length) return "—";
    return [...illnessData].sort((a, b) => b.count - a.count)[0].illness;
  })();

  return {
    totalCases,
    thisYearCases,
    topDistrict,
    topIllness,
    districtsCovered: districtStats.length,

    dailyTimelineData,
    monthlyTrendData,
    illnessData,
    severityData,
    districtData,
    districtStats,
  };
}
