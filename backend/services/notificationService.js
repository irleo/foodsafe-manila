import Notification from "../models/Notification.js";

export async function createNotification({
  type,
  title,
  message,
  dotColor = "blue",
  targetMonth = null,
  metadata = {},
}) {
  try {
    return await Notification.create({
      type,
      title,
      message,
      dotColor,
      targetMonth,
      metadata,
      unread: true,
    });
  } catch (error) {
    console.error("Failed to create notification:", error?.message || error);
    return null;
  }
}

export async function createUnusualReportNotification({
  districtKey,
  fromDate,
  count,
}) {
  const hour = new Date(fromDate).toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const existing = await Notification.findOne({
    type: "report_unusual",
    "metadata.districtKey": districtKey,
    "metadata.windowHour": hour,
  }).select("_id");

  if (existing) return existing;

  return createNotification({
    type: "report_unusual",
    title: "Unusual Report Volume",
    message: `${count} reports were submitted in the last 24 hours for ${districtKey.replace(/_/g, " ")}.`,
    dotColor: "red",
    metadata: { districtKey, windowHour: hour, count },
  });
}
