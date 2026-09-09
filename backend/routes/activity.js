import express from "express";
import { getRecentActivity } from "../controllers/activityController.js";
import {
  requireInternalRole,
  verifyToken,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
  "/",
  verifyToken,
  requireInternalRole("admin", "cesu", "surveillance_team"),
  getRecentActivity,
);

export default router;
