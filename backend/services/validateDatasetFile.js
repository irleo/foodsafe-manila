import fs from "fs";
import csv from "csv-parser";
import XLSX from "xlsx";

const REQUIRED_FIELDS = ["city", "district", "disease", "year", "cases"];

export async function validateDatasetFile(filePath) {
  const ext = filePath.toLowerCase().split(".").pop();

  if (ext === "csv") return validateCsv(filePath);
  if (ext === "xlsx" || ext === "xls") return validateExcel(filePath);

  throw new Error("Unsupported dataset format.");
}

function validateCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const errors = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("headers", (headers) => {
        const missing = REQUIRED_FIELDS.filter((f) => !headers.includes(f));
        if (missing.length) {
          reject(new Error(`Missing required columns: ${missing.join(", ")}`));
        }
      })
      .on("data", (row) => {
        if (!row.city || !row.disease) {
          errors.push("Missing required values");
        }
        if (Number(row.cases) < 0) {
          errors.push("Cases cannot be negative");
        }
        rows.push(row);
      })
      .on("end", () => {
        if (errors.length) {
          reject(new Error(`Dataset validation failed (${errors.length} errors)`));
        } else {
          resolve(rows);
        }
      })
      .on("error", reject);
  });
}

function validateExcel(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  if (!rows.length) throw new Error("Excel file has no rows.");

  const headers = Object.keys(rows[0]);
  const missing = REQUIRED_FIELDS.filter((f) => !headers.includes(f));
  if (missing.length) {
    throw new Error(`Missing required columns: ${missing.join(", ")}`);
  }

  rows.forEach((row, i) => {
    if (!row.city || !row.disease) {
      throw new Error(`Row ${i + 2}: Missing required values`);
    }
    if (Number(row.cases) < 0) {
      throw new Error(`Row ${i + 2}: Cases cannot be negative`);
    }
  });

  return rows;
}
