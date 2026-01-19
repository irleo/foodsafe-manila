import express from "express";
import { verifyToken, verifyRole } from "../middleware/authMiddleware.js";
import {
  uploadDataset,
  listDatasets,
  downloadDataset,
} from "../controllers/datasetController.js";

import { datasetUpload } from "../middleware/datasetUpload.js";

const router = express.Router();

router.get("/", verifyToken, listDatasets);

router.post(
  "/upload",
  verifyToken,
  verifyRole("admin"),
  datasetUpload.single("file"),
  uploadDataset
);

router.get("/:id/download", verifyToken, verifyRole("admin"), downloadDataset);

export default router;
