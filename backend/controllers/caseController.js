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

    const query = { datasetId: new mongoose.Types.ObjectId(datasetId) };
    if (req.query.year !== undefined && req.query.year !== "") {
      const y = Number(req.query.year);
      if (!Number.isFinite(y))
        return res.status(400).json({ message: "Invalid year" });
      query.year = y;
    }

    if (req.query.month !== undefined && req.query.month !== "") {
      const m = Number(req.query.month);
      if (!Number.isFinite(m) || m < 1 || m > 12)
        return res.status(400).json({ message: "Invalid month" });
      query.month = m;
    }

    if (req.query.barangayNo !== undefined && req.query.barangayNo !== "") {
      const b = Number(req.query.barangayNo);
      if (!Number.isFinite(b)) {
        return res.status(400).json({ message: "Invalid barangayNo" });
      }
      query.barangayNo = b;
    }

    if (req.query.district) query.district = String(req.query.district).trim();

    if (req.query.disease) query.disease = String(req.query.disease).trim();

    if (req.query.caseClassification)
      query.caseClassification = String(req.query.caseClassification)
        .trim()
        .toLowerCase();

    const [items, total] = await Promise.all([
      OfficialCase.find(query)
        .select(
          "city district barangay barangayNo disease year month caseClassification cases source datasetId",
        )
        .sort({
          year: 1,
          month: 1,
          district: 1,
          disease: 1,
          caseClassification: 1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),
      OfficialCase.countDocuments(query),
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
