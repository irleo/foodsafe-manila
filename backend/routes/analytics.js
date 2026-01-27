import express from "express";
import { getAnalyticsSummary } from "../controllers/analyticsController.js";

const router = express.Router();

router.get("/summary/:datasetId", getAnalyticsSummary);

export default router;
