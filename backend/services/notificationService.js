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
  triggerCount,
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
    title: "Operational report-review trigger reached",
    message: `${count} counted citizen reports were logged for ${districtKey.replace(/_/g, " ")} within the rolling 24-hour review window. Review the Report Logs for possible follow-up.`,
    dotColor: "orange",
    metadata: {
      districtKey,
      windowHour: hour,
      count,
      triggerCount,
      windowHours: 24,
      basis: "configured_operational_review_trigger",
      officialThreshold: false,
    },
  });
}
