import express from "express";
import { getAnalyticsSummary } from "../controllers/analyticsController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Protect analytics summary so only authenticated users can access dataset analytics
router.get("/summary/:datasetId", verifyToken, getAnalyticsSummary);

export default router;
