import express from "express";
import { getRecentActivity } from "../controllers/activityController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", verifyToken, getRecentActivity);

export default router;