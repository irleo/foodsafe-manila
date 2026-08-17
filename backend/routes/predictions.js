import express from "express";
import {
  getPredictions,
  refreshPredictions,
} from "../controllers/predictionController.js";
import { verifyToken, verifyRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// DB-backed: returns latest saved payload (no recomputation)
router.get("/", verifyToken, getPredictions);

router.post("/refresh", verifyToken, verifyRoles("admin", "cesu"), refreshPredictions);

export default router;
