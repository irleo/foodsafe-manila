import mongoose from "mongoose";

const DatasetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    dataSource: { type: String, default: "" },
    coverageStart: { type: Date, required: true },
    coverageEnd: { type: Date, required: true },

    originalFileName: { type: String, required: true },
    storedFileName: { type: String, required: true },
    filePath: { type: String, required: true },
    mimeType: { type: String, default: "" },

    // For official-case XLSX uploads:
    formatType: {
      type: String,
      enum: ["raw_health_office", "processed_template", "csv_generic"],
      default: "csv_generic",
      index: true,
    },
    diseases: { type: [String], default: [] },
    districts: { type: [String], default: [] },
    totalRows: { type: Number, default: 0 },
    insertedRows: { type: Number, default: 0 },
    skippedRows: { type: Number, default: 0 },
    validationErrors: { type: mongoose.Schema.Types.Mixed, default: null },

    status: {
      type: String,
      enum: ["pending", "validated", "failed"],
      default: "pending",
    },
    recordsCount: { type: Number, default: 0 },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // depends on JWT payload
    },

    errorMessage: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Dataset", DatasetSchema);
