import path from "path";
import fs from "fs";
import multer from "multer";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "datasets");

export function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export function isAllowedDatasetFile(filename = "") {
  const lower = filename.toLowerCase();
  return lower.endsWith(".csv") || lower.endsWith(".xlsx") || lower.endsWith(".xls");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const safeBase = path
      .basename(file.originalname)
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "");
    cb(null, `${Date.now()}__${safeBase}`);
  },
});

export const datasetUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    if (!isAllowedDatasetFile(file.originalname)) {
      return cb(new Error("Unsupported file type. Upload CSV or Excel (.xlsx/.xls)."));
    }
    cb(null, true);
  },
});
