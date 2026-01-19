import express from "express";
import { verifyToken, verifyRole } from "../middleware/authMiddleware.js";
import { getReports, createReport } from "../controllers/reportController.js";

const router = express.Router();

router.get("/", verifyToken, getReports);
router.post("/", verifyToken, verifyRole("admin"), createReport);

export default router;
