import express from "express";
import rateLimit from "express-rate-limit";
import { ErrorCodes } from "../errors/errorCodes.js";
import { getMobilePublicPredictions } from "../controllers/predictionController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getMobileDashboard,
  getMobileRiskHeatmap,
  getMobileNearbyRisk,
  getMobileOfficialAnalytics,
} from "../controllers/mobileController.js";

const router = express.Router();

const publicInsightsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: ErrorCodes.RATE_LIMITED,
    message: "Too many requests. Please try again later.",
  },
});

router.get("/dashboard", verifyToken, getMobileDashboard);
router.get("/risk/heatmap", verifyToken, getMobileRiskHeatmap);
router.get("/risk/nearby", verifyToken, getMobileNearbyRisk);
router.get("/official-cases/analytics", verifyToken, getMobileOfficialAnalytics);
router.get(
  "/insights/analytics",
  publicInsightsLimiter,
  getMobileOfficialAnalytics,
);
router.get(
  "/insights/predictions",
  publicInsightsLimiter,
  getMobilePublicPredictions,
);

export default router;
