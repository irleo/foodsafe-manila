import mongoose from "mongoose";

const officialCaseSchema = new mongoose.Schema(
  {
    datasetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dataset",
      required: true,
      index: { name: "officialCasesDatasetId" },
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
      index: { name: "officialCasesDistrict" },
    },

    barangay: {
      type: String,
      default: null,
      trim: true,
      index: { name: "officialCasesBarangay" },
    },

    barangayNo: {
      type: Number,
      default: null,
      min: 1,
      max: 999,
      index: { name: "officialCasesBarangayNo" },
    },

    disease: { type: String, required: true, trim: true },

    year: { type: Number, required: true, min: 2015, max: 2100 },

    month: { type: Number, required: true, min: 1, max: 12 },

    epidemiologicalYear: { type: Number, default: null, min: 2015, max: 2100 },
    epidemiologicalWeek: { type: Number, default: null, min: 1, max: 53 },
    weekStartDate: { type: Date, default: null },
    dateOfOnset: { type: Date, default: null },
    dateReported: { type: Date, default: null },
    surveillanceDate: { type: Date, default: null },
    surveillanceDateBasis: {
      type: String,
      enum: ["onset_date", "report_date", "provided_week_start", "provided_period", "legacy_unknown"],
      default: "legacy_unknown",
    },
    reportingFrequency: {
      type: String,
      enum: ["weekly", "monthly"],
      default: "monthly",
      required: true,
    },
    providerType: {
      type: String,
      enum: ["hospital", "health_center", "cesu", "doh", "citizen_patient_report"],
      default: "cesu",
      required: true,
    },
    providerName: { type: String, default: "CESU", trim: true, maxlength: 200 },

    caseClassification: {
      type: String,
      enum: ["confirmed", "suspected", "probable"],
      required: true,
      trim: true,
      index: { name: "officialCasesCaseClassification" },
    },

    cases: { type: Number, required: true, min: 1 },

    source: {
      type: String,
      enum: ["official", "csv", "excel", "system", "file", "cesu"],
      default: "official",
    },
  },
  { timestamps: true, collection: "officialCases" }
);

officialCaseSchema.index({ year: 1, month: 1 }, { name: "officialCasesYearMonth" });
officialCaseSchema.index(
  { epidemiologicalYear: 1, epidemiologicalWeek: 1, caseClassification: 1 },
  { name: "officialCasesEpidemiologicalPeriodClassification" },
);
officialCaseSchema.index(
  { district: 1, year: 1, month: 1 },
  { name: "officialCasesDistrictPeriod" },
);
officialCaseSchema.index(
  { barangayNo: 1, year: 1, month: 1 },
  { name: "officialCasesBarangayPeriod" },
);
officialCaseSchema.index(
  { disease: 1, year: 1, month: 1 },
  { name: "officialCasesDiseasePeriod" },
);
officialCaseSchema.index(
  { caseClassification: 1, year: 1, month: 1 },
  { name: "officialCasesClassificationPeriod" },
);

officialCaseSchema.index(
  {
    datasetId: 1,
    district: 1,
    barangayNo: 1,
    disease: 1,
    year: 1,
    month: 1,
    epidemiologicalYear: 1,
    epidemiologicalWeek: 1,
    reportingFrequency: 1,
    caseClassification: 1,
    source: 1,
  },
  { unique: true, name: "officialCasesPeriodUnique" }
);

export default mongoose.model("OfficialCase", officialCaseSchema);
