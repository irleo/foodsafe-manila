import Report from "../models/Report.js";
import { manilaDistrictCoords } from "../constants/manilaDistrictCoords.js";

const ALLOWED_SYMPTOMS = new Set([
  "nausea",
  "vomiting",
  "diarrhea",
  "abdominal_cramps",
  "fever",
  "headache",
  "dehydration",
]);


const MAX_REPORTS_PER_24H = 3;
const DUPLICATE_WINDOW_HOURS = 6;

function normalizeSymptom(s) {
  return String(s).trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeDistrictKey(d) {
  return String(d).trim().toLowerCase().replace(/\s+/g, "_");
}

function sameSet(a = [], b = []) {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const x of b) if (!sa.has(x)) return false;
  return true;
}

export const createReport = async (req, res) => {
  if (process.env.NODE_ENV !== "production") {
    console.log("HIT createReport", req.method, req.originalUrl);
  }

  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const {
      datasetId,
      location,
      exposureDistrict, // reported at district A but suspect exposure at district B
      symptoms,
      caseCount,
      foodSource,
      reportedAt,
    } = req.body || {};

    if (!location || typeof location !== "object") {
      return res.status(400).json({
        message: "Location with name, district and coordinates is required.",
      });
    }

    const { name, district, coordinates } = location;

    if (!name || !district) {
      return res.status(400).json({
        message: "Location name and district are required.",
      });
    }

    const reporterDistrictKey = normalizeDistrictKey(district);

    if (!manilaDistrictCoords[reporterDistrictKey]) {
      return res.status(400).json({ message: "Invalid Manila district." });
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

    // Validate optional exposureDistrict (food source district)
    let exposureDistrictKey = null;
    if (typeof exposureDistrict !== "undefined" && exposureDistrict !== null && exposureDistrict !== "") {
      exposureDistrictKey = normalizeDistrictKey(exposureDistrict);

      if (!manilaDistrictCoords[exposureDistrictKey]) {
        return res.status(400).json({ message: "Invalid exposure district." });
      }
    }

    if (!Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({ message: "At least one symptom is required." });
    }

    const normalizedSymptoms = Array.from(
      new Set(symptoms.map(normalizeSymptom).filter(Boolean))
    );

    if (normalizedSymptoms.length === 0) {
      return res.status(400).json({ message: "At least one symptom is required." });
    }

    for (const s of normalizedSymptoms) {
      if (!ALLOWED_SYMPTOMS.has(s)) {
        return res.status(400).json({ message: `Invalid symptom: ${s}` });
      }
    }

    const normalizedCaseCount =
      typeof caseCount === "undefined" ? 1 : Number(caseCount);

    if (!Number.isFinite(normalizedCaseCount) || normalizedCaseCount < 1) {
      return res.status(400).json({ message: "caseCount must be a positive number." });
    }

    const clampedCaseCount = Math.min(normalizedCaseCount, 10);

    const parsedReportedAt = reportedAt ? new Date(reportedAt) : new Date();
    if (Number.isNaN(parsedReportedAt.getTime())) {
      return res
        .status(400)
        .json({ message: "reportedAt must be a valid date if provided." });
    }

    const now = new Date();
    if (parsedReportedAt.getTime() > now.getTime() + 5 * 60 * 1000) {
      return res.status(400).json({ message: "reportedAt cannot be in the future." });
    }

    // Rate limit per user (DB-based)
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const reportsLast24h = await Report.countDocuments({
      reportedBy: req.user.id,
      createdAt: { $gte: since24h },
      source: "citizen_app",
    });

    if (reportsLast24h >= MAX_REPORTS_PER_24H) {
      return res.status(429).json({
        message: "Report limit reached. Please try again later.",
      });
    }

    // Duplicate suppression:
    // Use the *counting district* for dedupe (exposureDistrict if provided; else reporterDistrict)
    const countingDistrictKey = exposureDistrictKey || reporterDistrictKey;

    const dupSince = new Date(now.getTime() - DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000);

    const recentSimilar = await Report.findOne({
      reportedBy: req.user.id,
      $or: [
        { exposureDistrict: countingDistrictKey }, // if they used exposureDistrict before
        { exposureDistrict: null, "location.district": countingDistrictKey }, // fallback
      ],
      reportedAt: { $gte: dupSince },
      source: "citizen_app",
    })
      .sort({ reportedAt: -1 })
      .select("symptoms exposureDistrict location.district");

    let isCounted = true;
    let excludeReason = null;

    if (recentSimilar && sameSet(recentSimilar.symptoms, normalizedSymptoms)) {
      isCounted = false;
      excludeReason = "duplicate_window";
    }

    const payload = {
      datasetId: datasetId || null,
      location: {
        name: String(name).trim(),
        district: reporterDistrictKey,
        coordinates: { lat, lng },
      },
      exposureDistrict: exposureDistrictKey, // store separately
      symptoms: normalizedSymptoms,
      caseCount: clampedCaseCount,
      foodSource: foodSource ? String(foodSource).trim() : null,
      reportedAt: parsedReportedAt,
      reportedBy: req.user.id,
      source: "citizen_app",
      isCounted,
      excludeReason,
    };

    const report = await Report.create(payload);
    return res.status(201).json(report);
  } catch (error) {
    console.error("Error creating report:", error);
    return res.status(500).json({ message: "Failed to create report." });
  }
};

export const getReports = async (req, res) => {
  if (process.env.NODE_ENV !== "production") {
    console.log("HIT getReports", req.method, req.originalUrl);
  }

  try {
    const { datasetId, district, onlyCounted } = req.query;
    const limit = Math.min(Number(req.query.limit) || 2000, 5000);

    const query = {};
    if (datasetId) query.datasetId = datasetId;

    if (district) {
      const districtKey = normalizeDistrictKey(district);
      if (!manilaDistrictCoords[districtKey]) {
        return res.status(400).json({ message: "Invalid Manila district." });
      }

      // Allow filtering by either reporterDistrict or exposureDistrict
      query.$or = [
        { exposureDistrict: districtKey },
        { exposureDistrict: null, "location.district": districtKey },
      ];
    }

    if (onlyCounted === "true") query.isCounted = true;

    const reports = await Report.find(query)
      .sort({ reportedAt: -1 })
      .limit(limit);

    return res.json(reports);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch reports." });
  }
};