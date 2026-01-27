import mongoose from "mongoose";

const officialCaseSchema = new mongoose.Schema(
  {
    datasetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dataset",
      default: null,
      index: true,
    },

    city: { type: String, default: "Manila" },

    district: { type: String, required: true, trim: true },

    disease: { type: String, required: true, trim: true },

    year: { type: Number, required: true, min: 2015, max: 2100 },

    cases: { type: Number, required: true, min: 0 },

    source: {
      type: String,
      enum: ["official", "csv", "system"],
      default: "official",
    },
  },
  { timestamps: true }
);

// Prevents duplicates like same district+disease+year for same dataset
officialCaseSchema.index(
  { datasetId: 1, district: 1, disease: 1, year: 1 },
  { unique: true }
);

export default mongoose.model("OfficialCase", officialCaseSchema);
