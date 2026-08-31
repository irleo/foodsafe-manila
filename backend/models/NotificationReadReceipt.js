import mongoose from "mongoose";

const NotificationReadReceiptSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    notificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notification",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WebUser",
      required: true,
    },
  },
  { timestamps: true, collection: "notificationReadReceipts" },
);

NotificationReadReceiptSchema.index(
  { userId: 1, notificationId: 1 },
  { unique: true, name: "notificationReadReceiptsUserNotificationUnique" },
);

export default mongoose.model(
  "NotificationReadReceipt",
  NotificationReadReceiptSchema,
);
