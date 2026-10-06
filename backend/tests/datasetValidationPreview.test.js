import test from "node:test";
import assert from "node:assert/strict";
import XLSX from "xlsx";
import Dataset from "../models/Dataset.js";
import { validateOfficialWorkbook } from "../services/officialCaseValidationService.js";
import { importOfficialCasesXlsx } from "../services/officialCaseImportService.js";
import { previewFingerprint, issuePreviewToken, verifyPreviewToken } from "../services/datasetPreviewToken.js";
import { uploadDataset, handleDatasetUploadError } from "../controllers/datasetController.js";
import { validateWorkbookIsolated } from "../services/validateWorkbookIsolated.js";
import { afterDatasetSave } from "../services/afterDatasetSave.js";

test("distinct patients sharing analytical fields are retained; only identical source rows are skipped", () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Report date", "District", "Barangay", "Case Classification", "Patient ID"],
    ["2025-01-02", "I", "1", "confirmed", "patient-A"],
    ["2025-01-02", "I", "1", "confirmed", "patient-B"],
    ["2025-01-02", "I", "1", "confirmed", "patient-A"],
  ]), "Cholera");
  const result = validateOfficialWorkbook({ fileBuffer: XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), ...coverage });
  assert.equal(result.canUpload, true);
  assert.equal(result.validRowCount, 2);
  assert.equal(result.duplicateRows, 1);
  assert.equal(result.normalized.reduce((sum, row) => sum + row.cases, 0), 2);
});

test("validation worker bounds concurrent work and preserves normalized dates", async () => {
  const options = { fileBuffer: workbook([headers, good]), ...coverage };
  const first = validateWorkbookIsolated(options);
  const second = await validateWorkbookIsolated(options);
  assert.equal(second.canUpload, false);
  assert.match(second.reason, /retry/);
  const result = await first;
  assert.equal(result.canUpload, true);
  assert.ok(result.normalized[0].surveillanceDate instanceof Date);
  assert.equal((await validateWorkbookIsolated(options)).canUpload, true);
});

test("oversized worksheet dimensions are rejected", () => {
  const result = validate([[...headers, ...Array.from({ length: 95 }, (_, i) => `extra${i}`)], good]);
  assert.equal(result.canUpload, false);
  assert.match(result.errors[0].message, /supported limits/);
});

test("excessive declared ZIP expansion is rejected before parsing", async () => {
  const fileBuffer = workbook([headers, good]);
  const entry = fileBuffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  assert.ok(entry >= 0);
  fileBuffer.writeUInt32LE(65 * 1024 * 1024, entry + 24);
  const result = await validateWorkbookIsolated({ fileBuffer, ...coverage });
  assert.equal(result.canUpload, false);
  assert.match(result.reason, /resource limits/);
});

test("failed post-save side effects do not overturn import success", async (t) => {
  t.mock.method(console, "error", () => {});
  await assert.doesNotReject(afterDatasetSave(async () => { throw new Error("Notification unavailable"); }));
  let nextRan = false;
  await afterDatasetSave(async () => { nextRan = true; });
  assert.equal(nextRan, true);
});

const headers = ["district", "barangay", "disease", "report_date", "case_classification", "cases"];
const good = ["District 1", "1", "Cholera", "2025-01-02", "confirmed", 2];
const coverage = { declaredCoverageStart: new Date("2025-01-01"), declaredCoverageEnd: new Date("2025-01-31T23:59:59.999Z") };
function workbook(rows, extraSheets = {}) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "processed data");
  for (const [name, values] of Object.entries(extraSheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(values), name);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
const validate = (rows, extra) => validateOfficialWorkbook({ fileBuffer: workbook(rows, extra), ...coverage });

test("Excel calendar dates stay on January 1 in Manila, UTC, and negative offsets", () => {
  const previous = process.env.TZ;
  try {
    for (const timezone of ["Asia/Manila", "UTC", "America/Los_Angeles"]) {
      process.env.TZ = timezone;
      for (const date1904 of [false, true]) {
        const wb = XLSX.utils.book_new();
        const sheet = XLSX.utils.aoa_to_sheet([headers, good]);
        sheet.D2 = { t: "n", v: date1904 ? 42735 : 44197, z: "m/d/yy" };
        wb.Workbook = { WBProps: { date1904 } };
        XLSX.utils.book_append_sheet(wb, sheet, "processed data");
        const result = validateOfficialWorkbook({
          fileBuffer: XLSX.write(wb, { type: "buffer", bookType: "xlsx" }),
          declaredCoverageStart: new Date("2021-01-01T00:00:00Z"),
          declaredCoverageEnd: new Date("2021-01-01T23:59:59Z"),
        });
        assert.equal(result.canUpload, true, `${timezone}; date1904=${date1904}`);
        assert.equal(result.worksheets[0].rows[0].cells[3], "2021-01-01");
        assert.equal(result.normalized[0].surveillanceDate.toISOString(), "2021-01-01T00:00:00.000Z");
      }
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
function response() { return { code: 0, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }

test("mixed valid and invalid rows block import and report every field at physical Excel row", async () => {
  const rows = [headers, good, [], ["District 9", "", "Cholra", "not a date", "wrong", -1]];
  const result = validate(rows);
  assert.equal(result.canUpload, false);
  assert.equal(result.validRowCount, 1);
  for (const field of headers) assert.ok([...result.errors, ...result.warnings].some((e) => e.row === 4 && e.field === field), field);
  assert.ok(result.errors.some((e) => e.field === "cases" && e.column === "F"));
  const imported = await importOfficialCasesXlsx({ fileBuffer: workbook(rows), ...coverage, beforePersist: () => assert.fail("Must not persist") });
  assert.equal(imported.success, false);
});

test("missing values skip whole rows only after explicit confirmation", async () => {
  for (const index of headers.keys()) {
    const incomplete = [...good];
    incomplete[index] = "   ";
    const fileBuffer = workbook([headers, good, incomplete]);
    const result = validateOfficialWorkbook({ fileBuffer, ...coverage });
    assert.equal(result.canUpload, true, headers[index]);
    assert.equal(result.validRowCount, 1);
    assert.equal(result.missingFieldRows, 1);
    assert.equal(result.skippedRows, 1);
    assert.equal(result.requiresSkipConfirmation, true);
    assert.equal(result.normalized.reduce((sum, row) => sum + row.cases, 0), 2);
    assert.ok(result.warnings.some((issue) => issue.field === headers[index] && issue.row === 3 && issue.code === "missing_field"));
  }
  const fileBuffer = workbook([headers, good, ["", ...good.slice(1)]]);
  const blocked = await importOfficialCasesXlsx({ fileBuffer, ...coverage, beforePersist: async () => assert.fail("No confirmation") });
  assert.equal(blocked.success, false);
  await assert.rejects(importOfficialCasesXlsx({ fileBuffer, ...coverage, confirmSkipMissing: true, beforePersist: async () => { throw new Error("Confirmed storage boundary"); } }), /Confirmed storage boundary/);
});

test("missing values do not excuse invalid values or an empty import", () => {
  const incomplete = [...good];
  incomplete[0] = "";
  incomplete[2] = "Cholra";
  const invalid = validate([headers, good, incomplete]);
  assert.equal(invalid.canUpload, false);
  assert.ok(invalid.errors.some((issue) => issue.field === "disease"));
  incomplete[2] = "Cholera";
  assert.equal(validate([headers, incomplete]).canUpload, false);
  incomplete[3] = "2026-01-01";
  assert.equal(validate([headers, good, incomplete]).canUpload, false);
});

test("duplicate rows are nonblocking warnings and valid records show normalized fields", () => {
  const result = validate([headers, good, good]);
  assert.equal(result.canUpload, true);
  assert.equal(result.warningCount, 1);
  assert.equal(result.validRowCount, 1);
  assert.equal(result.warnings[0].row, 3);
  assert.equal(result.validRecords[0].reportDate, "2025-01-02");
  assert.equal(result.worksheets[0].rows[0].row, 2);
  assert.equal(result.worksheets[0].rows[0].cells[2], "Cholera");
});

test("valid workbooks reach the storage boundary only during import", async () => {
  const fileBuffer = workbook([headers, good]);
  assert.equal(validateOfficialWorkbook({ fileBuffer, ...coverage }).canUpload, true);
  let storageCalls = 0;
  await assert.rejects(importOfficialCasesXlsx({ fileBuffer, ...coverage, beforePersist: async () => {
    storageCalls++;
    throw new Error("Test storage boundary; no live writes");
  } }), /Test storage boundary/);
  assert.equal(storageCalls, 1);
});

test("raw disease worksheets and multiple processed sheets use the same validation pipeline", () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Report date", "District", "Barangay", "Case Classification"],
    ["2025-01-02", "I", "1", "confirmed"],
  ]), "Cholera");
  const result = validateOfficialWorkbook({ fileBuffer: XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), ...coverage });
  assert.equal(result.canUpload, true);
  assert.equal(result.formatType, "raw_health_office");
  const multiple = validate([headers, good], { Second: [headers, [...good.slice(0, 5), 3]] });
  assert.equal(multiple.validRowCount, 2);
  assert.equal(multiple.canUpload, true);
});

test("duplicate headers and formula cells block saving instead of trusting cached values", () => {
  assert.equal(validate([[...headers, "cases"], [...good, 2]]).canUpload, false);
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers, good]);
  sheet.F2.f = "1+1";
  XLSX.utils.book_append_sheet(wb, sheet, "processed data");
  const result = validateOfficialWorkbook({ fileBuffer: XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), ...coverage });
  assert.equal(result.canUpload, false);
  assert.ok(result.errors.some((issue) => issue.column === "F" && /Formula/.test(issue.message)));
});

test("missing columns, date coverage, and unrecognized sheets block a partly valid workbook", () => {
  assert.equal(validate([headers.slice(0, -1), good.slice(0, -1)]).canUpload, false);
  const result = validate([headers, good, [...good.slice(0, 3), "2025-02-01", "confirmed", 1]]);
  assert.ok(result.errors.some((e) => e.row === 3 && e.field === "report_date"));
  assert.equal(validate([headers, good], { "Cholra": [["Bad header"], ["value"]] }).canUpload, false);
  assert.equal(validate([headers, good], { Instructions: [["Read before importing"]] }).canUpload, true);
});

test("confirmation is bound to bytes, metadata and user; forged tokens are rejected", () => {
  process.env.ACCESS_TOKEN_SECRET = "test-only-preview-secret";
  const bytes = workbook([headers, good]);
  const metadata = { name: "Cases", coverageStart: "2025-01-01", coverageEnd: "2025-01-31", coverageVerified: "true" };
  const hash = previewFingerprint(bytes, metadata, "user1");
  const token = issuePreviewToken(hash);
  assert.equal(verifyPreviewToken(token, hash), true);
  assert.equal(verifyPreviewToken(token, previewFingerprint(bytes, metadata, "user2")), false);
  assert.equal(verifyPreviewToken(token, previewFingerprint(bytes, { ...metadata, name: "Changed" }, "user1")), false);
  assert.equal(verifyPreviewToken(token, previewFingerprint(Buffer.from("different"), metadata, "user1")), false);
  assert.equal(verifyPreviewToken("forged", hash), false);
});

test("preview and rejected uploads never create dataset records", async (t) => {
  process.env.ACCESS_TOKEN_SECRET = "test-only-preview-secret";
  let existing = null;
  t.mock.method(Dataset, "findOne", () => ({ select: () => ({ lean: async () => existing }) }));
  t.mock.method(Dataset, "create", () => assert.fail("No dataset should be created"));
  const req = { path: "/validate", user: { id: "user1" }, body: { name: "Cases", coverageStart: "2025-01-01", coverageEnd: "2025-01-31", coverageVerified: "true" }, file: { buffer: workbook([headers, good]), originalname: "cases.xlsx" } };
  const preview = response();
  await uploadDataset(req, preview);
  assert.equal(preview.code, 200);
  assert.ok(preview.body.validationToken);
  assert.equal(preview.body.normalized, undefined);
  const bypass = response();
  await uploadDataset({ ...req, path: "/upload" }, bypass);
  assert.equal(bypass.code, 400);
  const invalid = response();
  await uploadDataset({ ...req, file: { ...req.file, buffer: workbook([headers, good, ["invalid"]]) } }, invalid);
  assert.equal(invalid.body.canUpload, false);
  assert.equal(invalid.body.validationToken, null);
  const incompleteRequest = { ...req, file: { ...req.file, buffer: workbook([headers, good, ["", ...good.slice(1)]]) } };
  const incompletePreview = response();
  await uploadDataset(incompleteRequest, incompletePreview);
  assert.equal(incompletePreview.body.canUpload, true);
  assert.equal(incompletePreview.body.requiresSkipConfirmation, true);
  const unconfirmed = response();
  await uploadDataset({ ...incompleteRequest, path: "/upload", body: { ...req.body, validationToken: incompletePreview.body.validationToken } }, unconfirmed);
  assert.equal(unconfirmed.code, 400);
  assert.match(unconfirmed.body.message, /Confirm.*incomplete rows/);
  const rejected = response();
  await handleDatasetUploadError({ code: "LIMIT_FILE_SIZE" }, req, rejected, () => assert.fail());
  assert.equal(rejected.code, 400);
  existing = { _id: "saved-dataset", name: "Cases", status: "validated", formatType: "processed_template", insertedRows: 1 };
  const retry = response();
  await uploadDataset({ ...req, path: "/upload", body: { ...req.body, validationToken: preview.body.validationToken } }, retry);
  assert.equal(retry.code, 200);
  assert.equal(retry.body.alreadyImported, true);
  assert.equal(retry.body.datasetId, "saved-dataset");
});
