import ActivityLog from "../models/ActivityLog.js";

export async function logActivity({
  actor,
  actionType,
  title,
  subtitle = "",
  metadata = {},
}) {
  try {
    await ActivityLog.create({
      actor,
      actionType,
      title,
      subtitle,
      metadata,
    });
  } catch (error) {
    console.error("Failed to log activity:", error.message);
  }
}