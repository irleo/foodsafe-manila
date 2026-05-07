import Dataset from "../models/Dataset.js";
import Report from "../models/Report.js";
import User from "../models/User.js";

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

    const [latestReports, latestDatasets, pendingUsers] = await Promise.all([
      Report.find({})
        .sort({ reportedAt: -1, createdAt: -1 })
        .limit(limit)
        .select("reportedAt location.district exposureDistrict caseCount"),
      Dataset.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("name status createdAt recordsCount"),
      User.find({ status: "pending" })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("username createdAt"),
    ]);

    const reportNotifications = latestReports.map((r) =>
      toNotification({
        id: `report_${r._id}`,
        title: "New Report Received",
        message: `Report from ${r.exposureDistrict || r.location?.district || "unknown_district"} (${r.caseCount ?? 1} case/s).`,
        createdAt: r.reportedAt || r.createdAt,
        dotColor: "yellow",
      }),
    );

    const datasetNotifications = latestDatasets.map((d) =>
      toNotification({
        id: `dataset_${d._id}`,
        title: "Dataset Update",
        message: `${d.name} is ${d.status || "updated"}${Number.isFinite(d.recordsCount) ? ` (${d.recordsCount} records)` : ""}.`,
        createdAt: d.createdAt,
        dotColor: "green",
      }),
    );

    const userNotifications = pendingUsers.map((u) =>
      toNotification({
        id: `user_${u._id}`,
        title: "New User Request",
        message: `${u.username || "A user"} requested access.`,
        createdAt: u.createdAt,
        dotColor: "blue",
      }),
    );

    const notifications = [...reportNotifications, ...datasetNotifications, ...userNotifications]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return res.json(
      notifications.map(({ createdAt, ...rest }) => rest),
    );
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch notifications." });
  }
};
