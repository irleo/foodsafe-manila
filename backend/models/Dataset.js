import mongoose from "mongoose";

const DistrictCoverageSchema = new mongoose.Schema(
  {
    district: {
      type: String,
      enum: ["District 1", "District 2", "District 3", "District 4", "District 5", "District 6"],
      required: true,
    },
    coverageStart: { type: Date, required: true },
    coverageEnd: { type: Date, required: true },
    verifiedComplete: { type: Boolean, default: false },
    verificationSource: {
      type: String,
      enum: [
        "uploader_confirmation",
        "uploader_confirmation_file_range",
        "uploader_confirmation_derived_range",
        "derived_from_records",
        "legacy_unverified",
      ],
      default: "derived_from_records",
    },
  },
  { _id: false },
);

const DatasetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    dataSource: { type: String, default: "" },
    dataMode: {
      type: String,
      enum: ["official", "development"],
      required: true,
      default: "official",
    },
    providerType: {
      type: String,
      enum: ["hospital", "health_center", "cesu", "doh", "citizen_patient_report"],
      required: true,
      default: "cesu",
      index: true,
    },
    providerName: { type: String, required: true, trim: true, maxlength: 200, default: "CESU" },
    reportingFrequency: {
      type: String,
      enum: ["weekly", "monthly"],
      required: true,
      default: "weekly",
    },
    ingestionMethod: {
      type: String,
      enum: ["csv", "excel", "citizen_app", "system_integration", "file"],
      required: true,
      default: "file",
    },
    coverageStart: { type: Date, required: true },
    coverageEnd: { type: Date, required: true },
    districtCoverage: { type: [DistrictCoverageSchema], default: [] },

    originalFileName: { type: String, required: true },
    storedFileName: { type: String, required: true },
    filePath: { type: String, required: true },
    mimeType: { type: String, default: "" },
    contentHash: {
      type: String,
      trim: true,
      lowercase: true,
      minlength: 64,
      maxlength: 64,
    },

    // For official-case XLSX uploads:
    formatType: {
      type: String,
      enum: [
        "raw_health_office",
        "processed_template",
        "unrecognized_excel",
        // Retained only so historical CSV audit records remain readable.
        "processed_template_csv",
        "csv_generic",
      ],
      default: "unrecognized_excel",
      index: true,
    },
    diseases: { type: [String], default: [] },
    districts: { type: [String], default: [] },
    totalRows: { type: Number, default: 0 },
    insertedRows: { type: Number, default: 0 },
    skippedRows: { type: Number, default: 0 },
    validationErrorCount: { type: Number, default: 0, min: 0 },
    validationErrors: { type: mongoose.Schema.Types.Mixed, default: null },

    status: {
      type: String,
      enum: ["pending", "validated", "failed"],
      default: "pending",
    },
    recordsCount: { type: Number, default: 0 },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WebUser",
      required: false, // depends on JWT payload
    },

    errorMessage: { type: String, default: "" },
  },
  { timestamps: true, collection: "datasets" }
);

DatasetSchema.index(
  { contentHash: 1 },
  { unique: true, sparse: true, name: "dataset_content_hash_unique" },
);

export default mongoose.model("Dataset", DatasetSchema);
