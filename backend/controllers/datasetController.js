import fs from "fs";
import path from "path";
import csv from "csv-parser";
import xlsx from "xlsx";
import Dataset from "../models/Dataset.js";
import Report from "../models/Report.js";
import { manilaDistrictCoords } from "../constants/manilaDistrictCoords.js";
import { normalizeDistrict } from "../utils/normalizeDistrict.js";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

function parseDateSafe(v) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeSeverity(v) {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  if (s === "high") return "High";
  if (s === "moderate" || s === "medium") return "Moderate";
  return "Low";
}

// Expect CSV/Excel columns to map here.
function rowToReport(row) {
  // District
  const districtRaw = row.district || row.District || row.area || row.Area;
  if (!districtRaw) return null;
  const district = String(districtRaw).trim();

  // Location name
  const locationNameRaw =
    row.location_name ||
    row.locationName ||
    row.location ||
    row.Location ||
    district;
  const locationName = String(locationNameRaw || district).trim();

  // Illness
  const illnessRaw = row.illness || row.Illness;
  if (!illnessRaw) return null;
  const illness = String(illnessRaw).trim();

  // Severity (required by schema)
  const severityRaw = row.severity || row.Severity;
  const severity = normalizeSeverity(severityRaw);
  if (!["High", "Moderate", "Low"].includes(severity)) return null;

  // Reported date (required)
  const reportedAtRaw =
    row.reportedAt || row.ReportedAt || row.date || row.Date;
  const reportedAt = parseDateSafe(reportedAtRaw);
  if (!reportedAt) return null;

  // Optional
  const foodSourceRaw =
    row.foodSource || row.FoodSource || row.food_source || null;
  const foodSource = foodSourceRaw ? String(foodSourceRaw).trim() : null;

  // Coordinates: optional in dataset; required in Report schema
  let lat = Number(row.lat ?? row.Lat ?? row.latitude ?? row.Latitude);
  let lng = Number(row.lng ?? row.Lng ?? row.longitude ?? row.Longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  if (!hasCoords) {
    const norm = normalizeDistrict(district);
    const fallback = manilaDistrictCoords[norm];
    if (!fallback) return null; // Reject unknown district w/ no coords
    lat = fallback.lat;
    lng = fallback.lng;
  }

  return {
    location: {
      name: locationName,
      district,
      coordinates: { lat, lng },
    },
    illness,
    foodSource,
    severity,
    reportedAt,
    source: "csv",
  };
}

async function parseCsv(filePath) {
  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => rows.push(data))
      .on("end", resolve)
      .on("error", reject);
  });
  return rows;
}

function parseExcel(filePath) {
  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames?.[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet, { defval: "" });
}

export const uploadDataset = async (req, res) => {
  let dataset = null;

  try {
    const { name, coverageStart, coverageEnd, dataSource } = req.body;

    if (!req.file)
      return res.status(400).json({ message: "No file uploaded." });
    if (!name || !coverageStart || !coverageEnd) {
      return res
        .status(400)
        .json({ message: "Name and coverage dates are required." });
    }

    const start = new Date(coverageStart);
    const end = new Date(coverageEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ message: "Invalid coverage dates." });
    }
    if (start > end) {
      return res.status(400).json({ message: "Invalid coverage dates." });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let dataset = null;
    
    dataset = await Dataset.create({
      name,
      dataSource,
      coverageStart: start,
      coverageEnd: end,

      originalFileName: req.file.originalname,
      storedFileName: req.file.filename,
      filePath: req.file.path,
      mimeType: req.file.mimetype,

      status: "pending",
      uploadedBy: req.user.id,
    });

    let rawRows = [];
    if (ext === ".csv") rawRows = await parseCsv(filePath);
    else if (ext === ".xlsx" || ext === ".xls") rawRows = parseExcel(filePath);
    else {
      dataset.status = "failed";
      dataset.errorMessage = "Unsupported file type.";
      await dataset.save();
      return res.status(400).json({ message: dataset.errorMessage });
    }

    const reports = rawRows
      .map(rowToReport)
      .filter(Boolean)
      .map((r) => ({
        ...r,
        reportedBy: req.user?._id || req.user?.id || null,
        datasetId: dataset._id,
      }));

    if (reports.length === 0) {
      dataset.status = "failed";
      dataset.errorMessage = "No valid rows found. Check your columns/format.";
      await dataset.save();
      return res.status(400).json({ message: dataset.errorMessage });
    }

    // Insert reports
    await Report.insertMany(reports, { ordered: false });

    dataset.recordsCount = reports.length;
    dataset.status = "validated";
    dataset.errorMessage = "";
    await dataset.save();

    return res.status(201).json({
      message: "Dataset uploaded and validated.",
      dataset,
    });
  } catch (error) {
    if (dataset) {
      dataset.status = "failed";
      dataset.errorMessage = error.message || "Upload failed.";
      await dataset.save().catch(() => {});
    }
    return res.status(500).json({ message: error.message });
  }
};

export const listDatasets = async (req, res) => {
  try {
    const datasets = await Dataset.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .select("name recordsCount status coverageStart coverageEnd createdAt");
    res.json(datasets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const downloadDataset = async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) return res.status(404).json({ message: "Dataset not found." });

    if (!dataset.filePath || !fs.existsSync(dataset.filePath)) {
      return res.status(404).json({ message: "File missing on server." });
    }

    // send the original filename back to the user
    const filename = dataset.originalFileName || `${dataset.name}.csv`;

    res.download(dataset.filePath, filename);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

