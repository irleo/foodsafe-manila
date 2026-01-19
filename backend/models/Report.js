import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    datasetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dataset",
      default: null,
    },
    

    location: {
      name: { type: String, required: true },
      district: { type: String, required: true },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
    },

    illness: { type: String, required: true },
    caseCount: { type: Number, default: 1, min: 0 },

    // OPTIONAL
    foodSource: { type: String, default: null },

    severity: {
      type: String,
      enum: ["High", "Moderate", "Low"],
      required: true,
    },

    reportedAt: { type: Date, required: true },

    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    source: {
      type: String,
      enum: ["manual", "csv", "system"],
      default: "manual",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Report", reportSchema);
