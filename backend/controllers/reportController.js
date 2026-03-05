import Report from "../models/Report.js";

/**
 * Create report (Manual or CSV)
 *
 * Applies basic input validation and avoids logging full request bodies
 * to reduce the chance of leaking sensitive information in logs.
 */
export const createReport = async (req, res) => {
  // Minimal debug logging without sensitive body/header dumps
  if (process.env.NODE_ENV !== "production") {
    console.log("HIT createReport", req.method, req.originalUrl);
  }

  try {
    const {
      datasetId,
      location,
      illness,
      caseCount,
      foodSource,
      severity,
      reportedAt,
      source,
    } = req.body || {};

    // Basic structural validation
    if (!location || typeof location !== "object") {
      return res
        .status(400)
        .json({ message: "Location with name, district and coordinates is required." });
    }

    const { name, district, coordinates } = location;

    if (!name || !district) {
      return res
        .status(400)
        .json({ message: "Location name and district are required." });
    }

    if (
      !coordinates ||
      typeof coordinates.lat === "undefined" ||
      typeof coordinates.lng === "undefined"
    ) {
      return res
        .status(400)
        .json({ message: "Location coordinates (lat, lng) are required." });
    }

    const lat = Number(coordinates.lat);
    const lng = Number(coordinates.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res
        .status(400)
        .json({ message: "Location coordinates must be valid numbers." });
    }

    if (!illness || typeof illness !== "string") {
      return res.status(400).json({ message: "Illness is required." });
    }

    const allowedSeverities = ["High", "Moderate", "Low"];
    if (!severity || !allowedSeverities.includes(severity)) {
      return res
        .status(400)
        .json({ message: "Severity must be one of High, Moderate, or Low." });
    }

    const normalizedCaseCount =
      typeof caseCount === "undefined" ? 1 : Number(caseCount);

    if (!Number.isFinite(normalizedCaseCount) || normalizedCaseCount < 0) {
      return res
        .status(400)
        .json({ message: "caseCount must be a non‑negative number." });
    }

    const parsedReportedAt = reportedAt ? new Date(reportedAt) : new Date();
    if (Number.isNaN(parsedReportedAt.getTime())) {
      return res
        .status(400)
        .json({ message: "reportedAt must be a valid date if provided." });
    }

    const safeSource =
      source && ["manual", "csv", "system"].includes(source) ? source : "manual";

    // Build a whitelisted payload instead of passing req.body directly
    const payload = {
      datasetId: datasetId || null,
      location: {
        name: String(name).trim(),
        district: String(district).trim(),
        coordinates: {
          lat,
          lng,
        },
      },
      illness: illness.trim(),
      caseCount: normalizedCaseCount,
      foodSource: foodSource ? String(foodSource).trim() : null,
      severity,
      reportedAt: parsedReportedAt,
      // Tie report to the authenticated user when available
      reportedBy: req.user?.id || null,
      source: safeSource,
    };

    const report = await Report.create(payload);
    return res.status(201).json(report);
  } catch (error) {
    console.error("Error creating report:", error);
    return res.status(500).json({ message: "Failed to create report." });
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
