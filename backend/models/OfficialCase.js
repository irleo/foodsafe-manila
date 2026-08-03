import mongoose from "mongoose";

const officialCaseSchema = new mongoose.Schema(
  {
    datasetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dataset",
      required: true,
      index: true,
    },

    city: { type: String, default: "Manila" },

    district: {
      type: String,
      enum: [
        "District 1",
        "District 2",
        "District 3",
        "District 4",
        "District 5",
        "District 6",
      ],
      required: true,
      trim: true,
      index: true,
    },

    barangay: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    barangayNo: {
      type: Number,
      default: null,
      min: 1,
      max: 999,
      index: true,
    },

    disease: { type: String, required: true, trim: true },

    year: { type: Number, required: true, min: 2015, max: 2100 },

    month: { type: Number, required: true, min: 1, max: 12 },

    caseClassification: {
      type: String,
      enum: ["confirmed", "suspected", "probable"],
      required: true,
      trim: true,
      index: true,
    },

    cases: { type: Number, required: true, min: 0 },

    source: {
      type: String,
      enum: ["official", "csv", "excel", "system", "file"],
      default: "official",
    },
  },
  { timestamps: true, collection: "official_cases" }
);

officialCaseSchema.index({ year: 1, month: 1 });
officialCaseSchema.index({ district: 1, year: 1, month: 1 });
officialCaseSchema.index({ barangayNo: 1, year: 1, month: 1 });
officialCaseSchema.index({ disease: 1, year: 1, month: 1 });
officialCaseSchema.index({ caseClassification: 1, year: 1, month: 1 });

officialCaseSchema.index(
  {
    datasetId: 1,
    district: 1,
    barangayNo: 1,
    disease: 1,
    year: 1,
    month: 1,
    caseClassification: 1,
    source: 1,
  },
  { unique: true }
);

export default mongoose.model("OfficialCase", officialCaseSchema);
