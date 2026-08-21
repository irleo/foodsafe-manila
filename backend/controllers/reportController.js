import Report from "../models/Report.js";
import Dataset from "../models/Dataset.js";
import WebUser from "../models/WebUser.js";
import mongoose from "mongoose";
import { manilaDistrictCoords } from "../constants/manilaDistrictCoords.js";
import {
  createNotification,
  createUnusualReportNotification,
} from "../services/notificationService.js";
import { paginationMeta, parsePagination } from "../utils/pagination.js";
import { refreshDashboardSummaryAfterWrite } from "../services/dashboardSummaryService.js";
import { refreshMonthlyDistrictPredictions } from "../services/predictions/refreshMonthlyDistrictPredictions.js";
import { listReportAudit, recordReportAudit } from "../services/reportAuditService.js";

const REPORT_LIST_FIELDS = [
  "_id",
  "datasetId",
  "location.name",
  "location.district",
  "location.barangay",
  "exposureDistrict",
  "exposureBarangay",
  "symptoms",
  "caseCount",
  "foodSource",
  "reportedAt",
  "createdAt",
  "reportedBy",
  "source",
  "caseClassification",
  "currentStatus",
  "investigationStatus",
  "validationStatus",
  "investigation",
  "suspectedDecision",
  "validation",
  "remarks",
  "isCounted",
  "excludeReason",
].join(" ");

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
const UNUSUAL_REPORT_THRESHOLD_24H = 10;

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
      exposureBarangay,
      exposureBarangayNo,
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

    const { name, district, coordinates, barangay, barangayNo } = location;

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

    if (Number.isFinite(MAX_REPORTS_PER_24H) && reportsLast24h >= MAX_REPORTS_PER_24H) {
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
      .select("symptoms exposureDistrict location.district")
      .lean();

    let isCounted = true;
    let excludeReason = null;

    if (recentSimilar && sameSet(recentSimilar.symptoms, normalizedSymptoms)) {
      isCounted = false;
      excludeReason = "duplicate_window";
    }

    const parsedBarangayNo =
      barangayNo !== undefined && barangayNo !== null
        ? Number(barangayNo)
        : null;

    const parsedExposureBarangayNo =
      exposureBarangayNo !== undefined && exposureBarangayNo !== null
        ? Number(exposureBarangayNo)
        : null;

    const payload = {
      datasetId: datasetId || null,
      location: {
        name: String(name).trim(),
        district: reporterDistrictKey,
        barangay: barangay ? String(barangay).trim() : null,
        barangayNo:
          Number.isFinite(parsedBarangayNo) && parsedBarangayNo >= 1
            ? parsedBarangayNo
            : null,
        coordinates: { lat, lng },
      },
      exposureDistrict: exposureDistrictKey, // store separately
      exposureBarangay: exposureBarangay ? String(exposureBarangay).trim() : null,
      exposureBarangayNo:
        Number.isFinite(parsedExposureBarangayNo) && parsedExposureBarangayNo >= 1
          ? parsedExposureBarangayNo
          : null,
      symptoms: normalizedSymptoms,
      caseCount: clampedCaseCount,
      foodSource: foodSource ? String(foodSource).trim() : null,
      reportedAt: parsedReportedAt,
      reportedBy: req.user.id,
      source: "citizen_app",
      caseClassification: "reported",
      currentStatus: "reported",
      investigationStatus: "not_started",
      validationStatus: "not_started",
      isCounted,
      excludeReason,
    };

    const report = await Report.create(payload);
    await recordReportAudit({
      reportId: report._id,
      actorId: req.user.id,
      actorModel: "MobileUser",
      action: "report_submitted",
      previousStatus: "none",
      newStatus: "reported",
      details: { source: "citizen_patient_report" },
    });
    await refreshDashboardSummaryAfterWrite();

    const alertDistrict = exposureDistrictKey || reporterDistrictKey;
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const districtReportCount24h = await Report.countDocuments({
      source: "citizen_app",
      isCounted: true,
      reportedAt: { $gte: windowStart },
      $or: [
        { exposureDistrict: alertDistrict },
        { exposureDistrict: null, "location.district": alertDistrict },
      ],
    });

    await createNotification({
      type: "report_new",
      title: "New Report Received",
      message: `Report from ${alertDistrict.replace(/_/g, " ")} (${clampedCaseCount} case/s).`,
      dotColor: "yellow",
      metadata: {
        reportId: String(report._id),
        districtKey: alertDistrict,
        caseCount: clampedCaseCount,
      },
    });

    if (districtReportCount24h >= UNUSUAL_REPORT_THRESHOLD_24H) {
      await createUnusualReportNotification({
        districtKey: alertDistrict,
        fromDate: windowStart,
        count: districtReportCount24h,
      });
    }

    return res.status(201).json(report);
  } catch (error) {
    console.error("Error creating report:", error);
    return res.status(500).json({ message: "Failed to create report." });
  }
};

export const getUserReports = async (req, res) => {
  try {
    const { userId } = req.params;

    if (
      req.user?.accountType !== "citizen" ||
      String(req.user.id) !== String(userId)
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { page, limit, skip } = parsePagination(req.query);
    const query = { reportedBy: userId };
    const [reports, total] = await Promise.all([
      Report.find(query)
        .sort({ reportedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(REPORT_LIST_FIELDS)
        .lean(),
      Report.countDocuments(query),
    ]);

    const formattedReports = reports.map((report) => {
      const obj = report;
      const loc = obj.location || {};
      const reportLocation = loc.name || loc.district || "Unknown";
      const exposureSite =
        obj.exposureDistrict || obj.exposureBarangay || loc.name || "Unknown";
      const symptomsValue = obj.symptoms;
      const symptomsString = Array.isArray(symptomsValue)
        ? symptomsValue.join(", ")
        : (symptomsValue ?? "");

      return {
        ...obj,
        report_location: reportLocation,
        food_location: exposureSite,
        food_source: obj.foodSource ?? "",
        symptoms: symptomsString,
        reported_at: obj.reportedAt
          ? obj.reportedAt.toISOString()
          : obj.createdAt?.toISOString(),
      };
    });

    return res.json({
      items: formattedReports,
      pagination: paginationMeta({ page, limit, total }),
    });
  } catch (error) {
    console.error("Error fetching user reports:", error);
    return res.status(500).json({ message: "Failed to load reports" });
  }
};

export const getLastUserReport = async (req, res) => {
  try {
    const { userId } = req.params;

    if (
      req.user?.accountType !== "citizen" ||
      String(req.user.id) !== String(userId)
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const latestReport = await Report.findOne({ reportedBy: userId })
      .sort({ reportedAt: -1 })
      .select("reportedAt")
      .lean();

    return res.json({
      lastReportAt: latestReport ? latestReport.reportedAt : null,
    });
  } catch (error) {
    console.error("Error fetching last report:", error);
    return res.status(500).json({ message: "Failed to load last report" });
  }
};

export const getReports = async (req, res) => {
  if (process.env.NODE_ENV !== "production") {
    console.log("HIT getReports", req.method, req.originalUrl);
  }

  if (!["admin", "cesu", "surveillance_team"].includes(req.user?.role)) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const viewer = await WebUser.findById(req.user.id)
      .select("role canAccessPatientIdentity")
      .lean();
    if (!viewer || !["admin", "cesu", "surveillance_team"].includes(viewer.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const canAccessPatientIdentity =
      viewer.role === "admin" || viewer.canAccessPatientIdentity === true;
    const { datasetId, district, onlyCounted, from, to } = req.query;
    const { page, limit, skip } = parsePagination(req.query);

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

    if (from || to) {
      query.reportedAt = {};

      if (from) {
        const fromDate = new Date(from);
        if (Number.isNaN(fromDate.getTime())) {
          return res.status(400).json({ message: "Invalid from date." });
        }
        query.reportedAt.$gte = fromDate;
      }

      if (to) {
        const toDate = new Date(to);
        if (Number.isNaN(toDate.getTime())) {
          return res.status(400).json({ message: "Invalid to date." });
        }
        query.reportedAt.$lte = toDate;
      }
    }

    let reportsQuery = Report.find(query)
        .sort({ reportedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(REPORT_LIST_FIELDS)
        .populate("investigation.personnelIds", "username")
        .populate("investigation.recordedBy", "username")
        .populate("suspectedDecision.markedBy", "username")
        .populate("validation.validatedBy", "username");
    if (canAccessPatientIdentity) {
      reportsQuery = reportsQuery.populate("reportedBy", "username email phone_number");
    }

    const [reports, total] = await Promise.all([
      reportsQuery.lean(),
      Report.countDocuments(query),
    ]);

    // Back-compat: ensure caseClassification exists for old docs
    return res.json({
      items: reports.map((obj) => {
        const restrictedWorkflow = canAccessPatientIdentity
          ? {}
          : {
              investigation: obj.investigation
                ? {
                    ...obj.investigation,
                    locationVisited: "Restricted patient information",
                    findings: "Restricted patient information",
                    foodExposureInformation: "Restricted patient information",
                    remarks: "Restricted patient information",
                  }
                : obj.investigation,
              suspectedDecision: obj.suspectedDecision
                ? {
                    ...obj.suspectedDecision,
                    investigationFindings: "Restricted patient information",
                    remarks: "Restricted patient information",
                  }
                : obj.suspectedDecision,
              validation: obj.validation
                ? {
                    ...obj.validation,
                    laboratoryEvidence: "Restricted patient information",
                    supportingFindings: "Restricted patient information",
                    remarks: "Restricted patient information",
                  }
                : obj.validation,
              location: obj.location
                ? { ...obj.location, name: "Restricted patient information" }
                : obj.location,
              foodSource: obj.foodSource
                ? "Restricted patient information"
                : obj.foodSource,
              remarks: obj.remarks ? "Restricted patient information" : obj.remarks,
            };
        return {
          ...obj,
          caseClassification: obj?.caseClassification || "reported",
          currentStatus: obj?.currentStatus || "reported",
          investigationStatus: obj?.investigationStatus || "not_started",
          validationStatus: obj?.validationStatus || "not_started",
          ...restrictedWorkflow,
          ...(canAccessPatientIdentity ? {} : { reportedBy: undefined }),
        };
      }),
      pagination: paginationMeta({ page, limit, total }),
      permissions: { canAccessPatientIdentity },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch reports." });
  }
};

const workflowStatusFields =
  "currentStatus caseClassification investigationStatus validationStatus";

function requireText(value, fieldName) {
  const normalized = String(value || "").trim();
  if (!normalized) return { error: `${fieldName} is required.` };
  if (normalized.length > 4000) return { error: `${fieldName} is too long.` };
  return { value: normalized };
}

export const completeInvestigation = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found." });
    if (report.currentStatus !== "reported") {
      return res.status(409).json({ message: "This case has already advanced beyond investigation." });
    }

    const investigationDate = new Date(req.body?.investigationDate);
    if (Number.isNaN(investigationDate.getTime()) || investigationDate > new Date()) {
      return res.status(400).json({ message: "A valid investigation date is required and cannot be in the future." });
    }
    const locationVisited = requireText(req.body?.locationVisited, "Location visited");
    const findings = requireText(req.body?.findings, "Investigation findings");
    if (locationVisited.error || findings.error) {
      return res.status(400).json({ message: locationVisited.error || findings.error });
    }

    const symptoms = Array.isArray(req.body?.symptoms)
      ? req.body.symptoms.map(normalizeSymptom).filter(Boolean).slice(0, 20)
      : [];
    const personnelIds = Array.from(
      new Set([req.user.id, ...(Array.isArray(req.body?.personnelIds) ? req.body.personnelIds : [])].map(String)),
    );
    if (personnelIds.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ message: "One or more investigation personnel IDs are invalid." });
    }
    const validPersonnel = await WebUser.find({
      _id: { $in: personnelIds },
      role: { $in: ["surveillance_team", "cesu", "admin"] },
      status: "approved",
    }).select("_id").lean();
    if (validPersonnel.length !== personnelIds.length) {
      return res.status(400).json({ message: "Investigation personnel must be approved Data Managers or Surveillance Officers." });
    }

    report.investigation = {
      investigationId: new mongoose.Types.ObjectId(),
      investigationDate,
      personnelIds: validPersonnel.map((person) => person._id),
      locationVisited: locationVisited.value,
      findings: findings.value,
      symptoms,
      foodExposureInformation: String(req.body?.foodExposureInformation || "").trim(),
      remarks: String(req.body?.remarks || "").trim(),
      recordedBy: req.user.id,
      recordedAt: new Date(),
    };
    report.investigationStatus = "completed";
    await report.save();
    await recordReportAudit({
      reportId: report._id,
      actorId: req.user.id,
      action: "investigation_recorded",
      previousStatus: report.currentStatus,
      newStatus: report.currentStatus,
      details: { investigationId: String(report.investigation.investigationId) },
    });
    return res.json({ message: "Investigation completed.", report: await Report.findById(report._id).select(workflowStatusFields).lean() });
  } catch (error) {
    console.error("Error completing investigation:", error);
    return res.status(500).json({ message: "Failed to complete investigation." });
  }
};

export const markReportSuspected = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found." });
    if (report.investigationStatus !== "completed" || report.currentStatus !== "reported") {
      return res.status(409).json({ message: "A completed investigation is required before marking this case as suspected." });
    }

    const previousStatus = report.currentStatus;
    report.caseClassification = "suspected";
    report.currentStatus = "suspected";
    report.suspectedDecision = {
      outcome: "suspected",
      markedBy: req.user.id,
      markedAt: new Date(),
      investigationId: report.investigation?.investigationId,
      investigationFindings: report.investigation?.findings || "",
      reason: undefined,
      remarks: String(req.body?.remarks || "").trim(),
    };
    await report.save();
    await recordReportAudit({
      reportId: report._id,
      actorId: req.user.id,
      action: "marked_suspected",
      previousStatus,
      newStatus: "suspected",
      details: { investigationId: String(report.investigation?.investigationId || "") },
    });
    await refreshDashboardSummaryAfterWrite();
    return res.json({ message: "Case marked as suspected.", report: await Report.findById(report._id).select(workflowStatusFields).lean() });
  } catch (error) {
    console.error("Error marking case as suspected:", error);
    return res.status(500).json({ message: "Failed to mark case as suspected." });
  }
};

const RULE_OUT_REASONS = new Set([
  "fake_report",
  "not_foodborne_related",
  "duplicate_report",
  "insufficient_evidence",
  "other",
]);

export const ruleOutReport = async (req, res) => {
  try {
    const reason = String(req.body?.reason || "").trim().toLowerCase();
    if (!RULE_OUT_REASONS.has(reason)) {
      return res.status(400).json({
        message: "Select a valid reason for ruling out the report.",
      });
    }
    const remarks = String(req.body?.remarks || "").trim();
    if (reason === "other" && !remarks) {
      return res.status(400).json({
        message: "Remarks are required when the reason is Other.",
      });
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found." });
    if (report.investigationStatus !== "completed" || report.currentStatus !== "reported") {
      return res.status(409).json({
        message: "A completed investigation is required before ruling out this report.",
      });
    }

    const previousStatus = report.currentStatus;
    report.caseClassification = "ruled_out";
    report.currentStatus = "ruled_out";
    report.suspectedDecision = {
      outcome: "ruled_out",
      markedBy: req.user.id,
      markedAt: new Date(),
      investigationId: report.investigation?.investigationId,
      investigationFindings: report.investigation?.findings || "",
      reason,
      remarks,
    };
    report.isCounted = false;
    report.excludeReason = reason;
    await report.save();
    await recordReportAudit({
      reportId: report._id,
      actorId: req.user.id,
      action: "report_ruled_out",
      previousStatus,
      newStatus: "ruled_out",
      details: { reason },
    });
    await refreshDashboardSummaryAfterWrite();
    return res.json({
      message: "Report ruled out.",
      report: await Report.findById(report._id).select(workflowStatusFields).lean(),
    });
  } catch (error) {
    console.error("Error ruling out report:", error);
    return res.status(500).json({ message: "Failed to rule out report." });
  }
};

export const validateReport = async (req, res) => {
  try {
    const result = String(req.body?.result || "").trim();
    if (!["confirmed", "not_validated"].includes(result)) {
      return res.status(400).json({ message: "Confirmation result must be Confirmed or Not Confirmed." });
    }
    const supportingFindings = requireText(req.body?.supportingFindings, "Supporting findings");
    if (supportingFindings.error) return res.status(400).json({ message: supportingFindings.error });
    const laboratoryEvidence = {
      value: String(req.body?.laboratoryEvidence || "").trim(),
    };
    const condition =
      result === "confirmed"
        ? requireText(req.body?.condition, "Confirmed condition")
        : { value: String(req.body?.condition || "").trim() };
    if (condition.error) {
      return res.status(400).json({ message: condition.error });
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found." });
    if (report.currentStatus !== "suspected") {
      return res.status(409).json({ message: "Only a suspected case can receive a confirmation outcome." });
    }

    const previousStatus = report.currentStatus;
    report.caseClassification = result;
    report.currentStatus = result;
    report.validationStatus = result;
    report.validation = {
      validatedBy: req.user.id,
      validatedAt: new Date(),
      result,
      condition: condition.value,
      laboratoryEvidence: laboratoryEvidence.value,
      supportingFindings: supportingFindings.value,
      remarks: String(req.body?.remarks || "").trim(),
    };
    if (result === "confirmed" && !report.datasetId) {
      const reportedAt = new Date(report.reportedAt);
      const monthStart = new Date(
        Date.UTC(reportedAt.getUTCFullYear(), reportedAt.getUTCMonth(), 1),
      );
      const nextMonth = new Date(
        Date.UTC(reportedAt.getUTCFullYear(), reportedAt.getUTCMonth() + 1, 1),
      );
      const matchingDataset = await Dataset.findOne({
        status: "validated",
        coverageStart: { $lt: nextMonth },
        coverageEnd: { $gte: monthStart },
      })
        .sort({ createdAt: -1 })
        .select("_id")
        .lean();
      report.datasetId = matchingDataset?._id || null;
    }
    await report.save();
    await recordReportAudit({
      reportId: report._id,
      actorId: req.user.id,
      action: result === "confirmed" ? "case_confirmed" : "case_not_validated",
      previousStatus,
      newStatus: result,
      details: { condition: condition.value || undefined },
    });
    await refreshDashboardSummaryAfterWrite();
    if (result === "confirmed" && report.datasetId) {
      refreshMonthlyDistrictPredictions({
        trigger: "report_confirmation",
        datasetId: String(report.datasetId),
        horizonMonths: 1,
        force: true,
      }).catch((error) => {
        console.error("Prediction refresh after report confirmation failed:", error);
      });
    }
    return res.json({ message: "Case confirmation recorded.", report: await Report.findById(report._id).select(workflowStatusFields).lean() });
  } catch (error) {
    console.error("Error recording case confirmation:", error);
    return res.status(500).json({ message: "Failed to record case confirmation." });
  }
};

export const getReportAudit = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid report ID." });
    }
    const reportExists = await Report.exists({ _id: req.params.id });
    if (!reportExists) return res.status(404).json({ message: "Report not found." });
    const viewer = await WebUser.findById(req.user.id)
      .select("role canAccessPatientIdentity")
      .lean();
    const canAccessPatientIdentity = viewer?.role === "admin"
      || viewer?.canAccessPatientIdentity === true;
    const items = await listReportAudit(req.params.id, req.query.limit);
    return res.json({
      items: items.map((item) => (
        !canAccessPatientIdentity && item.actorModel === "MobileUser"
          ? { ...item, actorId: { username: "Restricted citizen identity" } }
          : item
      )),
    });
  } catch (error) {
    console.error("Error loading report audit trail:", error);
    return res.status(500).json({ message: "Failed to load report audit trail." });
  }
};
