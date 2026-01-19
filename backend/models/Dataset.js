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

    status: {
      type: String,
      enum: ["pending", "validated", "failed"],
      default: "pending",
    },
    recordsCount: { type: Number, default: 0 },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // depends on your JWT payload
    },

    errorMessage: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Dataset", DatasetSchema);
