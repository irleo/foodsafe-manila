import ActivityLog from "../models/ActivityLog.js";
import { paginationMeta, parsePagination } from "../utils/pagination.js";

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
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 5,
    });

    const [activities, total] = await Promise.all([
      ActivityLog.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("actionType title subtitle createdAt actor")
        .populate("actor", "username role")
        .lean(),
      ActivityLog.countDocuments({}),
    ]);

    return res.json({
      items: activities.map(toActivity),
      pagination: paginationMeta({ page, limit, total }),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch recent activity." });
  }
};
