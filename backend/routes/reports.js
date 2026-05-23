import express from "express";
import { verifyToken, verifyRole } from "../middleware/authMiddleware.js";
import {
  getReports,
  createReport,
  getUserReports,
  getLastUserReport,
} from "../controllers/reportController.js";

const router = express.Router();

router.get("/user/:userId/last", verifyToken, getLastUserReport);
router.get("/user/:userId", verifyToken, getUserReports);
router.get("/", verifyToken, getReports);
router.post("/", verifyToken, createReport);

export default router;
