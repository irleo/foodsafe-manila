import express from "express";
import { listCasesByDataset } from "../controllers/caseController.js";

const router = express.Router();

router.get("/:datasetId", listCasesByDataset);

export default router;
