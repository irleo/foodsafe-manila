import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getMobileDashboard,
  getMobileRiskHeatmap,
  getMobileNearbyRisk,
  getMobileOfficialAnalytics,
} from "../controllers/mobileController.js";

const router = express.Router();

router.get("/dashboard", verifyToken, getMobileDashboard);
router.get("/risk/heatmap", verifyToken, getMobileRiskHeatmap);
router.get("/risk/nearby", verifyToken, getMobileNearbyRisk);
router.get("/official-cases/analytics", verifyToken, getMobileOfficialAnalytics);

export default router;
