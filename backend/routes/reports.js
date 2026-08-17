import express from "express";
import { verifyToken, verifyRoles } from "../middleware/authMiddleware.js";
import {
  getReports,
  createReport,
  getUserReports,
  getLastUserReport,
  completeInvestigation,
  markReportSuspected,
  ruleOutReport,
  validateReport,
  getReportAudit,
} from "../controllers/reportController.js";

const router = express.Router();

router.get("/user/:userId/last", verifyToken, getLastUserReport);
router.get("/user/:userId", verifyToken, getUserReports);
const reportLogRoles = verifyRoles("admin", "cesu", "surveillance_team");

router.get("/", verifyToken, reportLogRoles, getReports);
router.get("/:id/audit", verifyToken, reportLogRoles, getReportAudit);
router.post("/", verifyToken, createReport);
router.post("/:id/investigation", verifyToken, reportLogRoles, completeInvestigation);
router.post("/:id/mark-suspected", verifyToken, reportLogRoles, markReportSuspected);
router.post("/:id/rule-out", verifyToken, reportLogRoles, ruleOutReport);
router.post("/:id/validation", verifyToken, reportLogRoles, validateReport);

export default router;
