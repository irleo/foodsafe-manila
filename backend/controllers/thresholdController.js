import mongoose from "mongoose";
import SurveillanceThresholdConfig from "../models/SurveillanceThresholdConfig.js";
import {
  calculateSurveillanceThreshold,
  FIXED_THRESHOLD_SETTINGS,
  THRESHOLD_FORMULA,
} from "../services/surveillanceThresholdService.js";

function userId(req) {
  return req.user?.id || req.user?._id;
}

function cleanExcludedPeriods(periods) {
  if (!Array.isArray(periods)) return [];
  return periods.map((period) => ({
    startYear: Number(period.startYear),
    startMonth: Number(period.startMonth),
    endYear: Number(period.endYear),
    endMonth: Number(period.endMonth),
    reason: String(period.reason || "").trim(),
  }));
}

function invalidPeriod(period) {
  const start = period.startYear * 12 + period.startMonth;
  const end = period.endYear * 12 + period.endMonth;
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
    periodType: "automatic_by_dataset_frequency",
    excludedPeriods: stored?.excludedPeriods || [],
    methodologyNotes: stored?.methodologyNotes || "Provisional DOH surveillance formula pending confirmation with CESU.",
    updatedAt: stored?.updatedAt || null,
    updatedBy: stored?.updatedBy || stored?.validatedBy || stored?.createdBy || null,
  };
}

export async function getThresholdSettings(req, res) {
  try {
    const stored = await loadStoredSettings();
    return res.json({ settings: settingsResponse(stored) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load threshold settings" });
  }
}

export async function updateThresholdSettings(req, res) {
  try {
    const excludedPeriods = cleanExcludedPeriods(req.body.excludedPeriods);
    if (excludedPeriods.some(invalidPeriod)) {
      return res.status(400).json({
        message: "Every excluded period requires valid start/end months and a reason",
      });
    }

    const existing = await SurveillanceThresholdConfig.findOne({ isActive: true });
    const values = {
      name: "Automatic five-year surveillance baseline",
      ...FIXED_THRESHOLD_SETTINGS,
      excludedPeriods,
      methodologyStatus: "draft",
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
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: error.message || "Unable to update threshold settings" });
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
      district: req.query.district ? String(req.query.district).trim() : undefined,
      excludedPeriods: stored?.excludedPeriods || [],
    });
    return res.json({
      result,
      automatic: true,
      settings: settingsResponse(stored),
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Unable to calculate the current surveillance threshold",
    });
  }
}
