import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import NotificationReadReceipt from "../models/NotificationReadReceipt.js";
import { paginationMeta, parsePagination } from "../utils/pagination.js";

function toNotification({
  id,
  type,
  title,
  message,
  createdAt,
  dotColor = "blue",
  unread = true,
  targetMonth = null,
  metadata = {},
}) {
  const isOperationalReportTrigger = type === "report_unusual";
  const districtLabel = metadata?.districtKey
    ? String(metadata.districtKey).replace(/_/g, " ")
    : "the selected district";
  const displayTitle = isOperationalReportTrigger
    ? "Operational report-review trigger reached"
    : title;
  const displayMessage = isOperationalReportTrigger
    ? `${metadata?.count ?? "Multiple"} counted citizen reports were logged for ${districtLabel} within the rolling ${metadata?.windowHours || 24}-hour review window. Review the Report Logs for possible follow-up.`
    : message;
  return {
    id,
    type,
    title: displayTitle,
    message: displayMessage,
    time: new Date(createdAt).toLocaleString(),
    createdAt: new Date(createdAt).toISOString(),
    dotColor: isOperationalReportTrigger ? "orange" : dotColor,
    unread,
    targetMonth,
    metadata,
  };
}

const REPORT_NOTIFICATION_TYPES = ["report_new", "report_unusual"];
const REPORT_WORKFLOW_ROLES = ["admin", "cesu", "surveillance_team"];

function visibilityFilter(role) {
  return REPORT_WORKFLOW_ROLES.includes(role)
    ? {}
    : { type: { $nin: REPORT_NOTIFICATION_TYPES } };
}

function receiptId(notificationId, userId) {
  return `${notificationId}:${userId}`;
}

export const getNotifications = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 10,
    });
    const query = visibilityFilter(req.user?.role);
    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("type title message createdAt dotColor unread targetMonth metadata")
        .lean(),
      Notification.countDocuments(query),
    ]);
    const notificationIds = notifications.map((notification) => notification._id);
    const receipts = notificationIds.length
      ? await NotificationReadReceipt.find({
          userId: req.user.id,
          notificationId: { $in: notificationIds },
        })
          .limit(notificationIds.length)
          .select("notificationId")
          .lean()
      : [];
    const readIds = new Set(receipts.map((receipt) => String(receipt.notificationId)));

    return res.json({
      items: notifications.map((n) =>
        toNotification({
          id: String(n._id),
          type: n.type,
          title: n.title,
          message: n.message,
          createdAt: n.createdAt,
          dotColor: n.dotColor || "blue",
          unread: Boolean(n.unread) && !readIds.has(String(n._id)),
          targetMonth: n.targetMonth,
          metadata: n.metadata || {},
        }),
      ),
      pagination: paginationMeta({ page, limit, total }),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch notifications." });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOne({
      _id: id,
      ...visibilityFilter(req.user?.role),
    }).select("_id");
    if (!notification) return res.status(404).json({ message: "Notification not found." });
    await NotificationReadReceipt.updateOne(
      { _id: receiptId(id, req.user.id) },
      {
        $setOnInsert: {
          notificationId: notification._id,
          userId: req.user.id,
        },
      },
      { upsert: true },
    );
    return res.json({ success: true, id: String(notification._id), unread: false });
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    return res.status(500).json({ message: "Failed to mark notification as read." });
  }
};

export const markNotificationUnread = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOne({
      _id: id,
      ...visibilityFilter(req.user?.role),
    }).select("_id");
    if (!notification) return res.status(404).json({ message: "Notification not found." });
    await Promise.all([
      NotificationReadReceipt.deleteOne({ _id: receiptId(id, req.user.id) }),
      Notification.updateOne({ _id: id, unread: false }, { $set: { unread: true } }),
    ]);
    return res.json({ success: true, id: String(notification._id), unread: true });
  } catch (error) {
    console.error("Failed to mark notification as unread:", error);
    return res.status(500).json({ message: "Failed to mark notification as unread." });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const userIdString = String(req.user.id);
    await Notification.aggregate([
      { $match: { unread: true, ...visibilityFilter(req.user?.role) } },
      {
        $project: {
          _id: {
            $concat: [{ $toString: "$_id" }, ":", { $literal: userIdString }],
          },
          notificationId: "$_id",
          userId: { $literal: userId },
          createdAt: "$$NOW",
          updatedAt: "$$NOW",
        },
      },
      {
        $merge: {
          into: "notificationReadReceipts",
          on: "_id",
          whenMatched: "keepExisting",
          whenNotMatched: "insert",
        },
      },
    ]);
    return res.json({ success: true });
  } catch (error) {
    console.error("Failed to mark all notifications as read:", error);
    return res.status(500).json({ message: "Failed to mark all notifications as read." });
  }
};
