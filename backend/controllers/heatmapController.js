import mongoose from "mongoose";
import { normalizeDistrictKey } from "../constants/manilaDistrictCoords.js";
import { getAnalyticalCaseRows } from "../services/analyticalCaseService.js";
import { logRequestError } from "../utils/serverLogger.js";

const ALLOWED_STATUSES = new Set(["reported", "suspected", "probable", "confirmed", "not_validated"]);

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
      includeReports: false,
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

    const optionRows = await getAnalyticalCaseRows({
      datasetId,
      statuses: [...ALLOWED_STATUSES],
      includeReports: false,
    });

    return res.json({
      points,
      districtStats,
      diseaseStats: [...diseaseTotals.entries()]
        .map(([name, cases]) => ({ name, cases }))
        .sort((a, b) => b.cases - a.cases),
      skippedBarangays,
      selectedCaseStatus: selectedStatus,
      caseDefinition: `${selectedStatus.replace("_", " ")} cases from authoritative CESU uploads only; statuses are kept separate.`,
      metricDefinition: "Map color and ordering represent case concentration, not an official risk classification.",
      filterOptions: {
        years: [...new Set(optionRows.map((row) => row.year).filter(Number.isFinite))],
        months: [...new Set(optionRows.map((row) => row.month).filter(Number.isFinite))],
        diseases: [...new Set(optionRows.map((row) => row.disease).filter(Boolean))],
        caseClassifications: [...ALLOWED_STATUSES],
      },
    });
  } catch (error) {
    logRequestError(error, req, "HEATMAP_SERVICE_ERROR");
    return res.status(error?.status || 500).json({
      code: "HEATMAP_SERVICE_ERROR",
      message: "Heatmap data is currently unavailable.",
    });
  }
};
