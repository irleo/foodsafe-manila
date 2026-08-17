import mongoose from "mongoose";

const dashboardSummarySchema = new mongoose.Schema(
  {
    scope: { type: String, required: true, default: "global" },
    year: { type: Number, required: true },
    totalCases: { type: Number, required: true, default: 0 },
    currentYearTotal: { type: Number, required: true, default: 0 },
    previousYearTotal: { type: Number, required: true, default: 0 },
    suspectedReports: { type: Number, required: true, default: 0 },
    reportedCases: { type: Number, required: true, default: 0 },
    suspectedCases: { type: Number, required: true, default: 0 },
    confirmedCases: { type: Number, required: true, default: 0 },
    notValidatedCases: { type: Number, required: true, default: 0 },
    totalDefinition: {
      type: String,
      default: "Confirmed official cases and confirmed surveillance reports",
    },
    topDistrict: { type: String, default: null },
    topDisease: { type: String, default: null },
    generatedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, collection: "dashboard_summaries" },
);

dashboardSummarySchema.index({ scope: 1, year: 1 }, { unique: true });

export default mongoose.model("DashboardSummary", dashboardSummarySchema);
