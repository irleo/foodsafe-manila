import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { getDistrictHeatmap } from "../controllers/heatmapController.js";

const router = express.Router();
router.get("/districts", verifyToken, getDistrictHeatmap);

export default router;
