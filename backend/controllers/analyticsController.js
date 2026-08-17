import Dataset from "../models/Dataset.js";
import { getAnalyticalCaseRows } from "../services/analyticalCaseService.js";
import {
  getYearRange,
  getMaxYearInData,
  buildDistrictStatisticsFromCases,
  buildYoYCaseStatsFromCases,
} from "../services/statisticsCaseBuilders.js";

export async function getAnalyticsSummary(req, res) {
  try {
    const { datasetId } = req.params;

    // Ensure dataset exists
    const dataset = await Dataset.findById(datasetId).select("_id name status").lean();
    if (!dataset) return res.status(404).json({ message: "Dataset not found." });

    const caseRows = await getAnalyticalCaseRows({
      datasetId,
      statuses: ["confirmed"],
    });

    const yearRange = getYearRange(caseRows);
    const baseYear = getMaxYearInData(caseRows);
    const previousYear = baseYear ? baseYear - 1 : null;

    const districtStats = buildDistrictStatisticsFromCases(caseRows);
    const yoy = buildYoYCaseStatsFromCases(caseRows);

    // Monthly analytics (for charts + filters)
    const totalCases = caseRows.reduce((s, r) => s + Number(r?.cases ?? 0), 0);

    const casesByMonthMap = new Map(); // key: YYYY-MM
    const casesByDiseaseMap = new Map();
    const casesByDistrictMap = new Map();
    const casesByClassMap = new Map();
    const yearsSet = new Set();
    const monthsSet = new Set();
    const diseasesSet = new Set();
    const districtsSet = new Set();
    const classSet = new Set();

    for (const r of caseRows) {
      const y = Number(r?.year);
      const m = Number(r?.month);
      const c = Number(r?.cases ?? 0);
      const disease = String(r?.disease || "").trim();
      const district = String(r?.district || "").trim();
      const cls = String(r?.caseClassification || "").trim();
      if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(c)) continue;
      if (m < 1 || m > 12) continue;

      yearsSet.add(y);
      monthsSet.add(m);
      if (disease) diseasesSet.add(disease);
      if (district) districtsSet.add(district);
      if (cls) classSet.add(cls);

      const key = `${y}-${String(m).padStart(2, "0")}`;
      casesByMonthMap.set(key, (casesByMonthMap.get(key) || 0) + c);
      if (disease) casesByDiseaseMap.set(disease, (casesByDiseaseMap.get(disease) || 0) + c);
      if (district) casesByDistrictMap.set(district, (casesByDistrictMap.get(district) || 0) + c);
      if (cls) casesByClassMap.set(cls, (casesByClassMap.get(cls) || 0) + c);
    }

    const casesByMonth = Array.from(casesByMonthMap.entries())
      .map(([ym, cases]) => ({ month: ym, cases }))
      .sort((a, b) => (a.month > b.month ? 1 : -1));

    const casesByDisease = Array.from(casesByDiseaseMap.entries())
      .map(([disease, cases]) => ({ disease, cases }))
      .sort((a, b) => b.cases - a.cases);

    const casesByDistrict = Array.from(casesByDistrictMap.entries())
      .map(([district, cases]) => ({ district, cases }))
      .sort((a, b) => b.cases - a.cases);

    const casesByCaseClassification = Array.from(casesByClassMap.entries())
      .map(([caseClassification, cases]) => ({ caseClassification, cases }))
      .sort((a, b) => b.cases - a.cases);

    return res.json({
      meta: {
        source: "mongo",
        datasetId,
        computedAt: new Date().toISOString(),
        rowCount: caseRows.length,
        totalCases,
        totalDefinition:
          "Confirmed official cases and confirmed surveillance reports",
        selectedCaseStatus: "confirmed",
        unionStrategy: "query_time_no_copy",
        yearRange,
        baseYear,
        previousYear,
        availableYears: Array.from(yearsSet).sort((a, b) => a - b),
        availableMonths: Array.from(monthsSet).sort((a, b) => a - b),
        availableDiseases: Array.from(diseasesSet).sort((a, b) => a.localeCompare(b)),
        availableDistricts: Array.from(districtsSet).sort((a, b) => a.localeCompare(b)),
        availableCaseClassifications: Array.from(classSet).sort((a, b) => a.localeCompare(b)),
      },
      yoy,
      casesByMonth,
      casesByDistrict,
      casesByDisease,
      casesByCaseClassification,
      districtStats,
      caseConcentrationByDistrict: districtStats,
    });
  } catch (err) {
    return res.status(err?.status || 500).json({
      message: "Failed to build analytics summary",
      error: err?.message,
    });
  }
}
