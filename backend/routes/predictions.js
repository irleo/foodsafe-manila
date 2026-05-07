import express from "express";
import {
  getPredictions,
  refreshPredictions,
} from "../controllers/predictionController.js";
import { verifyToken, verifyRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// DB-backed: returns latest saved payload (no recomputation)
router.get("/", verifyToken, getPredictions);

// Admin-only: manual refresh (recomputes + persists)
router.post("/refresh", verifyToken, verifyRole("admin"), refreshPredictions);

export default router;
