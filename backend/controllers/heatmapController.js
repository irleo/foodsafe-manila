import mongoose from "mongoose";
import OfficialCase from "../models/OfficialCase.js";
import { normalizeDistrictKey } from "../constants/manilaDistrictCoords.js";

function riskBand(cases) {
  const n = Number(cases ?? 0);
  if (n >= 31) return "Critical";
  if (n >= 16) return "High";
  if (n >= 6) return "Medium";
  return "Low";
}

function getBarangayNo(value, fallback) {
  const direct = Number(value);
  if (Number.isFinite(direct)) return direct;

  const match = String(fallback || "").match(/\d+/);
  const parsed = match ? Number(match[0]) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function isLikelyDiseaseName(value) {
  const v = String(value || "").trim();
  if (!v) return false;
  const normalized = v.toLowerCase();
  const blocked = new Set([
    "all",
    "total",
    "grand total",
    "unknown",
    "n/a",
    "na",
    "none",
    "others",
    "other",
    "undefined",
    "null",
  ]);
  if (blocked.has(normalized)) return false;
  if (normalized.includes("classification")) return false;
  if (normalized.includes("district")) return false;
  if (normalized.includes("barangay")) return false;
  return true;
}

export const getDistrictHeatmap = async (req, res) => {
  try {
    const { datasetId, year, month, disease, caseClassification } = req.query;

    if (!datasetId || !mongoose.Types.ObjectId.isValid(datasetId)) {
      return res.status(400).json({ message: "Invalid datasetId" });
    }

    const match = { datasetId: new mongoose.Types.ObjectId(datasetId) };

    if (year !== undefined && year !== "") {
      const y = Number(year);
      if (!Number.isFinite(y)) return res.status(400).json({ message: "Invalid year" });
      match.year = y;
    }

    if (month !== undefined && month !== "") {
      const m = Number(month);
      if (!Number.isFinite(m) || m < 1 || m > 12)
        return res.status(400).json({ message: "Invalid month" });
      match.month = m;
    }

    if (disease) {
      match.disease = String(disease).trim();
    }

    if (caseClassification) {
      match.caseClassification = String(caseClassification).trim().toLowerCase();
    }

    const rows = await OfficialCase.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            barangayNo: "$barangayNo",
            barangay: "$barangay",
            district: "$district",
          },
          totalCases: { $sum: "$cases" },
        },
      },
      { $sort: { totalCases: -1 } },
    ]);

    const districtTotals = new Map();
    const skippedBarangays = [];

    for (const r of rows) {
      const district = String(r._id?.district || "").trim();
      const districtKey = normalizeDistrictKey(district);
      const barangayNo = getBarangayNo(r._id?.barangayNo, r._id?.barangay);
      const cases = Number(r.totalCases ?? 0);
      if (barangayNo == null) {
        skippedBarangays.push(r._id);
        continue;
      }

      if (!districtTotals.has(districtKey)) {
        districtTotals.set(districtKey, {
          district,
          totalCases: 0,
          barangays: new Set(),
        });
      }
      const entry = districtTotals.get(districtKey);
      entry.totalCases += cases;
      entry.barangays.add(barangayNo);
    }

    const districtStats = new Map(
      [...districtTotals.entries()].map(([districtKey, entry]) => {
        const barangayCount = Math.max(1, entry.barangays.size);
        const avgIncidentPerBarangay = Number(
          (entry.totalCases / barangayCount).toFixed(2),
        );
        return [
          districtKey,
          {
            district: entry.district,
            districtKey,
            totalCases: entry.totalCases,
            barangayCount,
            avgIncidentPerBarangay,
            risk: riskBand(avgIncidentPerBarangay),
          },
        ];
      }),
    );

    const points = rows
      .map((r) => {
        const district = String(r._id?.district || "").trim();
        const districtKey = normalizeDistrictKey(district);
        const barangayNo = getBarangayNo(r._id?.barangayNo, r._id?.barangay);
        if (barangayNo == null) return null;
        const districtStat = districtStats.get(districtKey);
        const cases = Number(r.totalCases ?? 0);
        return {
          barangay: r._id?.barangay || `Barangay ${barangayNo}`,
          barangayNo,
          district,
          districtKey,
          cases,
          weight: cases,
          districtAvgIncident: districtStat?.avgIncidentPerBarangay ?? 0,
          districtTotalCases: districtStat?.totalCases ?? cases,
          risk: districtStat?.risk ?? riskBand(0),
        };
      })
      .filter(Boolean);

    const [filterOptions, diseaseStats] = await Promise.all([
      OfficialCase.aggregate([
      { $match: { datasetId: new mongoose.Types.ObjectId(datasetId) } },
      {
        $group: {
          _id: null,
          years: { $addToSet: "$year" },
          months: { $addToSet: "$month" },
          diseases: { $addToSet: "$disease" },
          caseClassifications: { $addToSet: "$caseClassification" },
        },
      },
      ]),
      OfficialCase.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$disease",
            cases: { $sum: "$cases" },
          },
        },
        { $sort: { cases: -1 } },
      ]),
    ]);

    if (skippedBarangays.length) {
      console.warn("Heatmap skipped barangays (missing barangayNo):", skippedBarangays);
    }

    return res.json({
      points,
      districtStats: [...districtStats.values()].sort(
        (a, b) => b.avgIncidentPerBarangay - a.avgIncidentPerBarangay,
      ),
      diseaseStats: diseaseStats
        .filter((d) => isLikelyDiseaseName(d?._id))
        .map((d) => ({ name: String(d._id).trim(), cases: Number(d.cases || 0) })),
      skippedBarangays,
      filterOptions: filterOptions[0] || {
        years: [],
        months: [],
        diseases: [],
        caseClassifications: [],
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Server error" });
  }
};
