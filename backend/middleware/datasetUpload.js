import multer from "multer";

export function isAllowedDatasetFile(filename = "") {
  const lower = filename.toLowerCase();
  return lower.endsWith(".xlsx") || lower.endsWith(".xls");
}

export const datasetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    if (!isAllowedDatasetFile(file.originalname)) {
      return cb(new Error("Unsupported file type. Upload an Excel workbook (.xlsx/.xls)."));
    }
    cb(null, true);
  },
});
