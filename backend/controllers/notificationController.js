import Notification from "../models/Notification.js";

function toNotification({
  id,
  title,
  message,
  createdAt,
  dotColor = "blue",
  unread = true,
}) {
  return {
    id,
    title,
    message,
    time: new Date(createdAt).toLocaleString(),
    createdAt: new Date(createdAt).toISOString(),
    dotColor,
    unread,
  };
}

export const getNotifications = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 5, 20);
    const notifications = await Notification.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("title message createdAt dotColor unread");

    return res.json(
      notifications.map((n) =>
        toNotification({
          id: String(n._id),
          title: n.title,
          message: n.message,
          createdAt: n.createdAt,
          dotColor: n.dotColor || "blue",
          unread: Boolean(n.unread),
        }),
      ),
    );
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch notifications." });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Notification.findByIdAndUpdate(
      id,
      { $set: { unread: false } },
      { new: true },
    ).select("_id");
    if (!updated) return res.status(404).json({ message: "Notification not found." });
    return res.json({ success: true, id: String(updated._id), unread: false });
  } catch (_) {
    return res.status(500).json({ message: "Failed to mark notification as read." });
  }
};

export const markNotificationUnread = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Notification.findByIdAndUpdate(
      id,
      { $set: { unread: true } },
      { new: true },
    ).select("_id");
    if (!updated) return res.status(404).json({ message: "Notification not found." });
    return res.json({ success: true, id: String(updated._id), unread: true });
  } catch (_) {
    return res.status(500).json({ message: "Failed to mark notification as unread." });
  }
};

export const markAllNotificationsRead = async (_req, res) => {
  try {
    await Notification.updateMany({ unread: true }, { $set: { unread: false } });
    return res.json({ success: true });
  } catch (_) {
    return res.status(500).json({ message: "Failed to mark all notifications as read." });
  }
};
