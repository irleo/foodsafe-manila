import express from "express";
import { verifyToken, verifyRoles } from "../middleware/authMiddleware.js";
import {
  uploadDataset,
  handleDatasetUploadError,
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
  verifyRoles("admin", "cesu"),
  datasetUpload.single("file"),
  handleDatasetUploadError,
  uploadDataset
);

router.get(
  "/template/official-cases",
  verifyToken,
  verifyRoles("admin", "cesu"),
  downloadOfficialCaseTemplate
);

router.get("/:id/download", verifyToken, verifyRoles("admin", "cesu"), downloadDataset);

export default router;
