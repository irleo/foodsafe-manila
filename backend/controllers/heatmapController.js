import mongoose from "mongoose";
import OfficialCase from "../models/OfficialCase.js";
import Report from "../models/Report.js";
import { normalizeDistrictKey } from "../constants/manilaDistrictCoords.js";
import { getAnalyticalCaseRows } from "../services/analyticalCaseService.js";

const ALLOWED_STATUSES = new Set(["reported", "suspected", "confirmed", "not_validated"]);

function getBarangayNo(value, fallback) {
  const direct = Number(value);
  if (Number.isFinite(direct)) return direct;
  const match = String(fallback || "").match(/\d+/);
  const parsed = match ? Number(match[0]) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function isLikelyDiseaseName(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(normalized) && !new Set([
    "all", "total", "grand total", "unknown", "n/a", "na", "none",
    "others", "other", "undefined", "null",
  ]).has(normalized);
}

export const getDistrictHeatmap = async (req, res) => {
  try {
    const { datasetId, year, month, disease } = req.query;
    if (!datasetId || !mongoose.isValidObjectId(datasetId)) {
      return res.status(400).json({ message: "Invalid datasetId" });
    }

    const selectedStatus = String(req.query.caseClassification || "confirmed")
      .trim()
      .toLowerCase();
    if (!ALLOWED_STATUSES.has(selectedStatus)) {
      return res.status(400).json({ message: "Select one valid case status; statuses are not combined automatically" });
    }
    const selectedYear = year === undefined || year === "" ? undefined : Number(year);
    const selectedMonth = month === undefined || month === "" ? undefined : Number(month);
    if (selectedYear !== undefined && !Number.isInteger(selectedYear)) {
      return res.status(400).json({ message: "Invalid year" });
    }
    if (selectedMonth !== undefined && (!Number.isInteger(selectedMonth) || selectedMonth < 1 || selectedMonth > 12)) {
      return res.status(400).json({ message: "Invalid month" });
    }

    const analyticalRows = await getAnalyticalCaseRows({
      datasetId,
      statuses: [selectedStatus],
      year: selectedYear,
      month: selectedMonth,
      disease: disease ? String(disease).trim() : undefined,
    });

    const barangayTotals = new Map();
    const diseaseTotals = new Map();
    const skippedBarangays = [];
    for (const row of analyticalRows) {
      const barangayNo = getBarangayNo(row.barangayNo, row.barangay);
      if (barangayNo == null) {
        skippedBarangays.push({ barangay: row.barangay, district: row.district });
        continue;
      }
      const district = String(row.district || "").trim();
      const districtKey = normalizeDistrictKey(district);
      const key = `${barangayNo}:${districtKey}`;
      const current = barangayTotals.get(key) || {
        barangay: row.barangay || `Barangay ${barangayNo}`,
        barangayNo,
        district,
        districtKey,
        cases: 0,
      };
      current.cases += Number(row.cases || 0);
      barangayTotals.set(key, current);
      if (isLikelyDiseaseName(row.disease)) {
        diseaseTotals.set(row.disease, (diseaseTotals.get(row.disease) || 0) + Number(row.cases || 0));
      }
    }

    const districtTotals = new Map();
    for (const point of barangayTotals.values()) {
      const current = districtTotals.get(point.districtKey) || {
        district: point.district,
        districtKey: point.districtKey,
        totalCases: 0,
        barangayCount: 0,
      };
      current.totalCases += point.cases;
      current.barangayCount += 1;
      districtTotals.set(point.districtKey, current);
    }
    const grandTotal = [...districtTotals.values()].reduce((sum, item) => sum + item.totalCases, 0);
    const districtStats = [...districtTotals.values()]
      .map((item) => ({
        ...item,
        avgCasesPerBarangay: Number((item.totalCases / Math.max(1, item.barangayCount)).toFixed(2)),
        concentrationShare: grandTotal > 0 ? Number(((item.totalCases / grandTotal) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.totalCases - a.totalCases);
    const statsByDistrict = new Map(districtStats.map((item) => [item.districtKey, item]));
    const points = [...barangayTotals.values()].map((point) => ({
      ...point,
      weight: point.cases,
      districtTotalCases: statsByDistrict.get(point.districtKey)?.totalCases || point.cases,
      districtConcentrationShare: statsByDistrict.get(point.districtKey)?.concentrationShare || 0,
    }));

    const [officialOptions, reportOptions] = await Promise.all([
      OfficialCase.aggregate([
        { $match: { datasetId: new mongoose.Types.ObjectId(datasetId) } },
        { $group: { _id: null, years: { $addToSet: "$year" }, months: { $addToSet: "$month" }, diseases: { $addToSet: "$disease" } } },
      ]),
      Report.aggregate([
        { $match: { isCounted: true, caseClassification: "confirmed" } },
        { $project: { year: { $year: "$reportedAt" }, month: { $month: "$reportedAt" }, disease: "$validation.condition" } },
        { $group: { _id: null, years: { $addToSet: "$year" }, months: { $addToSet: "$month" }, diseases: { $addToSet: "$disease" } } },
      ]),
    ]);
    const officialFilterOptions = officialOptions[0] || {};
    const reportFilterOptions = reportOptions[0] || {};

    return res.json({
      points,
      districtStats,
      diseaseStats: [...diseaseTotals.entries()]
        .map(([name, cases]) => ({ name, cases }))
        .sort((a, b) => b.cases - a.cases),
      skippedBarangays,
      selectedCaseStatus: selectedStatus,
      caseDefinition: `${selectedStatus.replace("_", " ")} cases only; statuses are kept separate. Confirmed results combine uploaded official cases and confirmed surveillance reports at query time without copying records.`,
      metricDefinition: "Map color and ordering represent case concentration, not an official risk classification.",
      filterOptions: {
        years: [...new Set([...(officialFilterOptions.years || []), ...(reportFilterOptions.years || [])])],
        months: [...new Set([...(officialFilterOptions.months || []), ...(reportFilterOptions.months || [])])],
        diseases: [...new Set([...(officialFilterOptions.diseases || []), ...(reportFilterOptions.diseases || [])])].filter(Boolean),
        caseClassifications: [...ALLOWED_STATUSES],
      },
    });
  } catch (error) {
    return res.status(error?.status || 500).json({ message: error?.message || "Server error" });
  }
};
