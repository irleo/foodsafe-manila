import fs from "fs";
import csv from "csv-parser";
import xlsx from "xlsx";
import path from "path";

export async function parseDatasetFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".csv") {
    return parseCsv(filePath);
  }

  if (ext === ".xlsx" || ext === ".xls") {
    return parseXlsx(filePath);
  }

  throw new Error("Unsupported file type. Please upload CSV or Excel (.xlsx/.xls).");
}

function parseCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => rows.push(data))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

function parseXlsx(filePath) {
  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames?.[0];
  if (!sheetName) return [];
  const ws = wb.Sheets[sheetName];
  // defval: "" keeps empty cells
  return xlsx.utils.sheet_to_json(ws, { defval: "" });
}
