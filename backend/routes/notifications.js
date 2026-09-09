import express from "express";
import {
  requireInternalRole,
  verifyToken,
} from "../middleware/authMiddleware.js";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from "../controllers/notificationController.js";

const router = express.Router();

const internalNotifications = requireInternalRole(
  "admin",
  "cesu",
  "surveillance_team",
);

router.get("/", verifyToken, internalNotifications, getNotifications);
router.patch("/read-all", verifyToken, internalNotifications, markAllNotificationsRead);
router.patch("/:id/read", verifyToken, internalNotifications, markNotificationRead);
router.patch("/:id/unread", verifyToken, internalNotifications, markNotificationUnread);

export default router;
