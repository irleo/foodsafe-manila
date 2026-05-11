import express from "express";
import { verifyToken, verifyRole } from "../middleware/authMiddleware.js";
import {
  uploadDataset,
  listDatasets,
  downloadDataset,
  downloadOfficialCaseTemplate,
} from "../controllers/datasetController.js";

import { datasetUpload } from "../middleware/datasetUpload.js";

const router = express.Router();

router.get("/", verifyToken, listDatasets);

router.post(
  "/upload",
  verifyToken,
  datasetUpload.single("file"),
  uploadDataset
);

router.get(
  "/template/official-cases",
  verifyToken,
  verifyRole("admin"),
  downloadOfficialCaseTemplate
);

router.get("/:id/download", verifyToken, verifyRole("admin"), downloadDataset);

export default router;
