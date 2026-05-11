import mongoose from "mongoose";
import OfficialCase from "../models/OfficialCase.js";
import Report from "../models/Report.js";

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Returns normalized case rows from official cases and/or mobile reports.
 *
 * shape:
 * { sourceType, city, district, disease, year, month, caseClassification, cases, source }
 */
export async function getNormalizedCaseRows({
  includeOfficial = true,
  includeReports = false,
  datasetId,
  year,
  month,
  district,
  disease,
  caseClassification,
} = {}) {
  const out = [];

  const y = toNum(year);
  const m = toNum(month);

  if (includeOfficial) {
    const q = {};
    if (datasetId && mongoose.Types.ObjectId.isValid(datasetId)) {
      q.datasetId = new mongoose.Types.ObjectId(datasetId);
    }
    if (y !== null) q.year = y;
    if (m !== null) q.month = m;
    if (district) q.district = String(district).trim();
    if (disease) q.disease = String(disease).trim();
    if (caseClassification)
      q.caseClassification = String(caseClassification).trim().toLowerCase();

    const rows = await OfficialCase.find(q)
      .select("city district disease year month caseClassification cases source")
      .lean();

    for (const r of rows) {
      out.push({
        sourceType: "official",
        city: r.city || "Manila",
        district: r.district,
        disease: r.disease,
        year: r.year,
        month: r.month,
        caseClassification: r.caseClassification,
        cases: r.cases,
        source: r.source || "official",
      });
    }
  }

  if (includeReports) {
    const q = {};
    if (datasetId && mongoose.Types.ObjectId.isValid(datasetId)) {
      q.datasetId = new mongoose.Types.ObjectId(datasetId);
    }
    if (district) {
      const key = String(district).trim().toLowerCase().replace(/\s+/g, "_");
      q.$or = [
        { exposureDistrict: key },
        { exposureDistrict: null, "location.district": key },
      ];
    }
    if (caseClassification) {
      q.caseClassification = String(caseClassification).trim().toLowerCase();
    }

    const rows = await Report.find(q)
      .select(
        "reportedAt location.district exposureDistrict caseCount source caseClassification",
      )
      .lean();

    for (const r of rows) {
      const d = r.reportedAt ? new Date(r.reportedAt) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      const yy = d.getUTCFullYear();
      const mm = d.getUTCMonth() + 1;
      if (y !== null && yy !== y) continue;
      if (m !== null && mm !== m) continue;

      const dist = (r.exposureDistrict || r.location?.district || "").trim();
      out.push({
        sourceType: "mobile_report",
        city: "Manila",
        district: dist,
        disease: disease ? String(disease).trim() : "Suspected foodborne illness",
        year: yy,
        month: mm,
        caseClassification: r.caseClassification || "suspected",
        cases: Number(r.caseCount || 1),
        source: r.source || "citizen_app",
      });
    }
  }

  return out;
}

