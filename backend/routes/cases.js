import express from "express";
import { listCasesByDataset } from "../controllers/caseController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/:datasetId", verifyToken, listCasesByDataset);

export default router;
