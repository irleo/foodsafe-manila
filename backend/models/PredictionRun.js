import mongoose from "mongoose";

const predictionRunSchema = new mongoose.Schema(
  {
    model: {
      type: String,
      enum: ["prophet"],
      default: "prophet",
      required: true,
      index: { name: "predictionRunsModel" },
    },

    granularity: {
      type: String,
      enum: ["yearly_total_cases", "monthly_district_cases", "weekly_disease_district_cases", "monthly_disease_district_cases"],
      required: true,
      index: { name: "predictionRunsGranularity" },
    },

    datasetScope: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: "all",
      index: { name: "predictionRunsDatasetScope" },
      // Can be "all" or a Dataset ObjectId
    },

    trigger: {
      type: String,
      enum: ["official_upload", "report_confirmation", "monthly_fallback", "weekly_fallback", "manual"],
      required: true,
      index: { name: "predictionRunsTrigger" },
    },

    startedAt: {
      type: Date,
      default: null,
      index: { name: "predictionRunsStartedAt" },
    },

    finishedAt: {
      type: Date,
      default: null,
      index: { name: "predictionRunsFinishedAt" },
    },

    generatedAt: {
      type: Date,
      default: Date.now,
      index: { name: "predictionRunsGeneratedAt" },
    },

    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      // Active payload contains monthly forecasts for every supported disease and district.
    },

    status: {
      type: String,
      enum: ["success", "failed", "running"],
      default: "running",
      required: true,
      index: { name: "predictionRunsStatus" },
    },

    errorMessage: {
      type: String,
      default: null,
    },

    basisDatasetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dataset",
      default: null,
      index: { name: "predictionRunsBasisDatasetId" },
    },

    // Latest calendar year present in official case rows used for this run (max `year` in aggregated series).
    basisYear: {
      type: Number,
      default: null,
      min: 2015,
      max: 2100,
      index: { name: "predictionRunsBasisYear" },
    },

    // When scope is a single dataset: month (1–12) from that dataset's `coverageEnd` (upload metadata).
    // Yearly case rows have no month; this is the "as of" boundary from the upload. Null for global scope.
    basisMonth: {
      type: Number,
      default: null,
      min: 1,
      max: 12,
    },
    basisWeek: {
      type: Number,
      default: null,
      min: 1,
      max: 53,
    },

    // Calendar years covered by the forward-looking forecast (inclusive). Yearly Prophet currently emits one horizon year.
    forecastStartYear: {
      type: Number,
      default: null,
      min: 2015,
      max: 2100,
      index: { name: "predictionRunsForecastStartYear" },
    },

    forecastEndYear: {
      type: Number,
      default: null,
      min: 2015,
      max: 2100,
      index: { name: "predictionRunsForecastEndYear" },
    },

    // Monthly forecast targets (used when granularity = monthly_district_cases)
    forecastTargetYear: {
      type: Number,
      default: null,
      min: 2015,
      max: 2100,
      index: { name: "predictionRunsForecastTargetYear" },
    },
    forecastTargetMonth: {
      type: Number,
      default: null,
      min: 1,
      max: 12,
      index: { name: "predictionRunsForecastTargetMonth" },
    },
    forecastTargetWeek: {
      type: Number,
      default: null,
      min: 1,
      max: 53,
      index: { name: "predictionRunsForecastTargetWeek" },
    },
    forecastHorizonMonths: {
      type: Number,
      default: null,
      min: 1,
      max: 36,
    },
    forecastHorizonWeeks: {
      type: Number,
      default: null,
      min: 1,
      max: 12,
    },
    inputFingerprint: {
      type: String,
      default: null,
      trim: true,
      minlength: 64,
      maxlength: 64,
    },
  },
  { timestamps: true, collection: "predictionRuns" }
);

// Ensure single run per (model+granularity+scope). This prevents recompute storms
// and guarantees "only one forecast exists per dataset upload".
predictionRunSchema.index(
  { model: 1, granularity: 1, datasetScope: 1, generatedAt: -1 },
  { name: "predictionRunsModelGranularityScopeGeneratedAt" },
);

// Checking latest forecast basis
predictionRunSchema.index({
  basisDatasetId: 1,
  basisYear: 1,
  generatedAt: -1,
}, { name: "predictionRunsBasisDatasetYearGeneratedAt" });

const PredictionRun =
  mongoose.models.PredictionRun ||
  mongoose.model("PredictionRun", predictionRunSchema);

export default PredictionRun;
