import mongoose from "mongoose";
import { logRequestError } from "../utils/serverLogger.js";
import SurveillanceThresholdConfig from "../models/SurveillanceThresholdConfig.js";
import {
  calculateSurveillanceThreshold,
  FIXED_THRESHOLD_SETTINGS,
  THRESHOLD_FORMULA,
} from "../services/surveillanceThresholdService.js";
import { normalizeSurveillanceDisease } from "../constants/surveillanceMethodology.js";

const MANILA_DISTRICTS = new Set(
  Array.from({ length: 6 }, (_, index) => `District ${index + 1}`),
);

function userId(req) {
  return req.user?.id || req.user?._id;
}

export function normalizeExcludedPeriods(periods) {
  if (!Array.isArray(periods)) return { value: [] };
  const value = [];
  for (const [index, period] of periods.entries()) {
    const diseaseInput = String(period?.disease || "").trim();
    const disease = diseaseInput
      ? normalizeSurveillanceDisease(diseaseInput)
      : null;
    if (diseaseInput && !disease) {
      return {
        error: `Excluded period ${index + 1} has an unsupported disease.`,
      };
    }

    const districtInput = String(period?.district || "").trim();
    const districtMatch = districtInput.match(/^district\s*([1-6])$/i);
    const district = districtMatch ? `District ${districtMatch[1]}` : null;
    if (districtInput && (!district || !MANILA_DISTRICTS.has(district))) {
      return {
        error: `Excluded period ${index + 1} must use District 1 through District 6.`,
      };
    }

    value.push({
      startYear: Number(period?.startYear),
      startMonth: Number(period?.startMonth),
      endYear: Number(period?.endYear),
      endMonth: Number(period?.endMonth),
      disease,
      district,
      reason: String(period?.reason || "").trim(),
    });
  }
  return { value };
}

function invalidPeriod(period) {
  const start = period.startYear * 100 + period.startMonth;
  const end = period.endYear * 100 + period.endMonth;
  return !Number.isInteger(period.startYear)
    || !Number.isInteger(period.startMonth)
    || !Number.isInteger(period.endYear)
    || !Number.isInteger(period.endMonth)
    || period.startMonth < 1
    || period.startMonth > 12
    || period.endMonth < 1
    || period.endMonth > 12
    || start > end
    || !period.reason;
}

async function loadStoredSettings() {
  return SurveillanceThresholdConfig.findOne({ isActive: true })
    .sort({ updatedAt: -1 })
    .populate("createdBy updatedBy validatedBy", "username email role")
    .lean();
}

function settingsResponse(stored) {
  return {
    formula: THRESHOLD_FORMULA,
    baselineYears: FIXED_THRESHOLD_SETTINGS.baselineYears,
    alertSdMultiplier: FIXED_THRESHOLD_SETTINGS.alertSdMultiplier,
    epidemicSdMultiplier: FIXED_THRESHOLD_SETTINGS.epidemicSdMultiplier,
    periodType: "calendar_month",
    excludedPeriods: stored?.excludedPeriods || [],
    methodologyNotes: stored?.methodologyNotes || "Validated post-interview monthly comparison methodology; source records retain DOH morbidity weeks.",
    updatedAt: stored?.updatedAt || null,
    updatedBy: stored?.updatedBy || stored?.validatedBy || stored?.createdBy || null,
  };
}

export async function getThresholdSettings(req, res) {
  try {
    const stored = await loadStoredSettings();
    return res.json({ settings: settingsResponse(stored) });
  } catch (error) {
    logRequestError(error, req, "THRESHOLD_SETTINGS_ERROR");
    return res.status(500).json({ message: "Threshold settings could not be loaded." });
  }
}

export async function updateThresholdSettings(req, res) {
  try {
    const normalizedPeriods = normalizeExcludedPeriods(req.body.excludedPeriods);
    if (normalizedPeriods.error) {
      return res.status(400).json({ message: normalizedPeriods.error });
    }
    const excludedPeriods = normalizedPeriods.value;
    if (excludedPeriods.some(invalidPeriod)) {
      return res.status(400).json({
        message: "Every excluded period requires valid start/end months and a reason",
      });
    }

    const existing = await SurveillanceThresholdConfig.findOne({ isActive: true });
    const values = {
      name: "Monthly disease surveillance baseline",
      baselineYears: FIXED_THRESHOLD_SETTINGS.baselineYears,
      minimumBaselineYears: FIXED_THRESHOLD_SETTINGS.baselineYears,
      alertSdMultiplier: FIXED_THRESHOLD_SETTINGS.alertSdMultiplier,
      epidemicSdMultiplier: FIXED_THRESHOLD_SETTINGS.epidemicSdMultiplier,
      condition: "disease_specific",
      geographicLevel: "city",
      excludedPeriods,
      methodologyStatus: "validated",
      methodologyNotes: String(req.body.methodologyNotes || "").trim(),
      isActive: true,
      updatedBy: userId(req),
    };
    const stored = existing
      ? await SurveillanceThresholdConfig.findByIdAndUpdate(
        existing._id,
        { $set: values },
        { new: true, runValidators: true },
      )
      : await SurveillanceThresholdConfig.create({
        ...values,
        createdBy: userId(req),
      });
    return res.json({ settings: settingsResponse(stored) });
  } catch (error) {
    if (error?.name === "ValidationError") {
      return res.status(400).json({ message: "Threshold settings are invalid." });
    }
    logRequestError(error, req, "THRESHOLD_SETTINGS_ERROR");
    return res.status(500).json({ message: "Threshold settings could not be updated." });
  }
}

export async function getCurrentThreshold(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.query.datasetId)) {
      return res.status(400).json({ message: "A valid datasetId is required" });
    }
    const stored = await loadStoredSettings();
    const result = await calculateSurveillanceThreshold({
      datasetId: req.query.datasetId,
      disease: req.query.disease,
      district: req.query.district ? String(req.query.district).trim() : undefined,
      targetYear: req.query.targetYear,
      targetMonth: req.query.targetMonth,
      excludedPeriods: stored?.excludedPeriods || [],
    });
    return res.json({
      result,
      automatic: true,
      settings: settingsResponse(stored),
    });
  } catch (error) {
    logRequestError(error, req, "THRESHOLD_CALCULATION_ERROR");
    return res.status(error.status || 500).json({
      message: "The surveillance threshold could not be calculated.",
    });
  }
}
