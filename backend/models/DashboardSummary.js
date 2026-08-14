import mongoose from "mongoose";

const dashboardSummarySchema = new mongoose.Schema(
  {
    scope: { type: String, required: true, default: "global" },
    year: { type: Number, required: true },
    totalCases: { type: Number, required: true, default: 0 },
    currentYearTotal: { type: Number, required: true, default: 0 },
    previousYearTotal: { type: Number, required: true, default: 0 },
    suspectedReports: { type: Number, required: true, default: 0 },
    topDistrict: { type: String, default: null },
    topDisease: { type: String, default: null },
    riskLevelCounts: {
      critical: { type: Number, required: true, default: 0 },
      high: { type: Number, required: true, default: 0 },
      medium: { type: Number, required: true, default: 0 },
      low: { type: Number, required: true, default: 0 },
    },
    generatedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, collection: "dashboard_summaries" },
);

dashboardSummarySchema.index({ scope: 1, year: 1 }, { unique: true });

export default mongoose.model("DashboardSummary", dashboardSummarySchema);
