import express from "express";
import {
  getCurrentThreshold,
  getThresholdSettings,
  updateThresholdSettings,
} from "../controllers/thresholdController.js";
import { verifyRoles, verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();
const surveillanceRoles = verifyRoles("admin", "cesu", "surveillance_team");

router.get("/current", verifyToken, surveillanceRoles, getCurrentThreshold);
router.get("/settings", verifyToken, verifyRoles("admin", "cesu"), getThresholdSettings);
router.put("/settings", verifyToken, verifyRoles("admin", "cesu"), updateThresholdSettings);

export default router;
