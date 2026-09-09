import express from "express";
import {
  requireInternalRole,
  verifyToken,
} from "../middleware/authMiddleware.js";
import {
  uploadDataset,
  handleDatasetUploadError,
  listDatasets,
  downloadDataset,
  downloadOfficialCaseTemplate,
} from "../controllers/datasetController.js";

import { datasetUpload } from "../middleware/datasetUpload.js";

const router = express.Router();

router.get(
  "/",
  verifyToken,
  requireInternalRole("admin", "cesu", "surveillance_team"),
  listDatasets,
);

router.post(
  "/upload",
  verifyToken,
  requireInternalRole("admin", "cesu"),
  datasetUpload.single("file"),
  handleDatasetUploadError,
  uploadDataset
);

router.get(
  "/template/official-cases",
  verifyToken,
  requireInternalRole("admin", "cesu"),
  downloadOfficialCaseTemplate
);

router.get(
  "/:id/download",
  verifyToken,
  requireInternalRole("admin", "cesu"),
  downloadDataset,
);

export default router;
