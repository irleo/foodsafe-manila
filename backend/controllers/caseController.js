import mongoose from "mongoose";
import OfficialCase from "../models/OfficialCase.js";

export const listCasesByDataset = async (req, res) => {
  try {
    const { datasetId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(datasetId)) {
      return res.status(400).json({ message: "Invalid datasetId" });
    }

    const limit = Math.min(Number(req.query.limit ?? 200), 1000);
    const skip = Math.max(Number(req.query.skip ?? 0), 0);

    const [items, total] = await Promise.all([
      OfficialCase.find({ datasetId })
        .select("city district disease year cases source datasetId")
        .sort({ year: 1, district: 1, disease: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      OfficialCase.countDocuments({ datasetId }),
    ]);

    return res.json({
      datasetId,
      total,
      limit,
      skip,
      items,
    });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Server error" });
  }
};
