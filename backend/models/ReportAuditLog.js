import mongoose from "mongoose";

const ReportAuditLogSchema = new mongoose.Schema(
  {
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Report",
      required: true,
      immutable: true,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
      refPath: "actorModel",
    },
    actorModel: {
      type: String,
      enum: ["WebUser", "MobileUser"],
      required: true,
      immutable: true,
    },
    action: {
      type: String,
      enum: [
        "report_submitted",
        "investigation_recorded",
        "marked_suspected",
        "report_ruled_out",
        "case_confirmed",
        "case_not_validated",
      ],
      required: true,
      immutable: true,
    },
    previousStatus: { type: String, required: true, immutable: true },
    newStatus: { type: String, required: true, immutable: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {}, immutable: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "report_audit_logs",
  },
);

ReportAuditLogSchema.index({ reportId: 1, createdAt: 1 });

export default mongoose.model("ReportAuditLog", ReportAuditLogSchema);
