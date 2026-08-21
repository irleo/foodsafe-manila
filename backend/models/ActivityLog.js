import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WebUser",
      required: true,
    },
    actionType: {
      type: String,
      required: true,
      enum: [
        "dataset_uploaded",
        "dataset_validated",
        "dataset_failed",
        "user_approved",
        "user_rejected",
        "user_suspended",
        "user_reactivated",
        "user_access_updated",
        "password_reset",
        "prediction_generated",
        "report_reviewed",
        "alert_acknowledged",
        "analytics_exported",
      ],
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "activity_logs",
  },
);

export default mongoose.model("ActivityLog", activityLogSchema);
