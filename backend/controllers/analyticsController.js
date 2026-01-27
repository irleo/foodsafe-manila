import Dataset from "../models/Dataset.js";
import OfficialCase from "../models/OfficialCase.js";
import {
  getYearRange,
  getMaxYearInData,
  buildDistrictStatisticsFromCases,
  buildRiskLevelDonutDataFromDistrictStats,
  buildYoYCaseStatsFromCases,
} from "../services/statisticsCaseBuilders.js";

export async function getAnalyticsSummary(req, res) {
  try {
    const { datasetId } = req.params;

    // Ensure dataset exists
    const dataset = await Dataset.findById(datasetId).select("_id name status").lean();
    if (!dataset) return res.status(404).json({ message: "Dataset not found." });

    const caseRows = await OfficialCase.find({ datasetId })
      .select("city district disease year cases source datasetId")
      .lean();

    const yearRange = getYearRange(caseRows);
    const baseYear = getMaxYearInData(caseRows);
    const previousYear = baseYear ? baseYear - 1 : null;

    const districtStats = buildDistrictStatisticsFromCases(caseRows);
    const riskDonut = buildRiskLevelDonutDataFromDistrictStats(districtStats);
    const yoy = buildYoYCaseStatsFromCases(caseRows);

    return res.json({
      meta: {
        source: "mongo",
        datasetId,
        computedAt: new Date().toISOString(),
        rowCount: caseRows.length,
        yearRange,
        baseYear,
        previousYear,
      },
      yoy,
      districtStats,
      riskDonut,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to build analytics summary",
      error: err?.message,
    });
  }
}
