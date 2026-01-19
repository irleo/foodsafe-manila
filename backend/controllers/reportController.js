import Report from "../models/Report.js";

/**
 * Create report (Manual or CSV)
 */
export const createReport = async (req, res) => {
  console.log("HIT createReport", req.method, req.originalUrl, req.body);
  console.log("createReport headers origin:", req.headers.origin);
  console.log("createReport referer:", req.headers.referer);
  console.log("createReport content-type:", req.headers["content-type"]);
  console.log("createReport body:", req.body);


  try {
    const report = await Report.create(req.body);
    res.status(201).json(report);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * Get reports (for heatmap & charts)
 * Supports optional query params:
 * - datasetId
 * - limit (default 2000)
 */
export const getReports = async (req, res) => {
  console.log("HIT getReports", req.method, req.originalUrl);

  try {
    const { datasetId } = req.query;
    const limit = Math.min(Number(req.query.limit) || 2000, 5000);

    const query = {};
    if (datasetId) query.datasetId = datasetId; // only if you add datasetId to Report schema

    const reports = await Report.find(query)
      .sort({ reportedAt: -1 })
      .limit(limit);

    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
