import ActivityLog from "../models/ActivityLog.js";

function toActivity(activity) {
  return {
    id: activity._id,
    type: activity.actionType,
    title: activity.title,
    subtitle: activity.subtitle,
    createdAt: activity.createdAt,
    actor: activity.actor
      ? {
          id: activity.actor._id,
          username: activity.actor.username,
          role: activity.actor.role,
        }
      : null,
  };
}

export const getRecentActivity = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 5, 20);

    const activities = await ActivityLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("actor", "username role");

    return res.json(activities.map(toActivity));
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch recent activity." });
  }
};