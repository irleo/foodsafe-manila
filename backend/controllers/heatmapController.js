import mongoose from "mongoose";
import OfficialCase from "../models/OfficialCase.js";
import { manilaDistrictCoords } from "../constants/manilaDistrictCoords.js";
import { normalizeDistrict } from "../utils/normalizeDistrict.js";

export const getDistrictHeatmap = async (req, res) => {
  try {
    const { datasetId, year, disease } = req.query;

    if (!datasetId || !mongoose.Types.ObjectId.isValid(datasetId)) {
      return res.status(400).json({ message: "Invalid datasetId" });
    }

    const match = { datasetId: new mongoose.Types.ObjectId(datasetId) };

    if (year !== undefined && year !== "") {
      const y = Number(year);
      if (!Number.isFinite(y)) return res.status(400).json({ message: "Invalid year" });
      match.year = y;
    }

    if (disease) {
      match.disease = String(disease).trim();
    }

    // Group cases by district
    const rows = await OfficialCase.aggregate([
      { $match: match },
      { $group: { _id: "$district", totalCases: { $sum: "$cases" } } },
      { $sort: { totalCases: -1 } },
    ]);

    const points = rows
      .map((r) => {
        const district = String(r._id || "").trim();
        const norm = normalizeDistrict(district);
        const coords = manilaDistrictCoords[norm];
        if (!coords) return null; // skip unknown district
        return {
          district,
          lat: coords.lat,
          lng: coords.lng,
          cases: r.totalCases,
        };
      })
      .filter(Boolean);

    return res.json(points);
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Server error" });
  }
};
