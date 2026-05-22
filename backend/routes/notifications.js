import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from "../controllers/notificationController.js";

const router = express.Router();

router.get("/", verifyToken, getNotifications);
router.patch("/:id/read", verifyToken, markNotificationRead);
router.patch("/:id/unread", verifyToken, markNotificationUnread);
router.patch("/read-all", verifyToken, markAllNotificationsRead);

export default router;
