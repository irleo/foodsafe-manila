import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "report_new",
        "report_unusual",
        "dataset_validated",
        "dataset_failed",
        "user_access_request",
        "password_reset",
        "prediction_generated",
      ],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    dotColor: { type: String, default: "blue" },
    unread: { type: Boolean, default: true, index: true },
    targetMonth: { type: String, default: null, trim: true }, // YYYY-MM
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "notifications" },
);

notificationSchema.index({ createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
