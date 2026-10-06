import { parentPort, workerData } from "node:worker_threads";
import { validateOfficialWorkbook } from "./officialCaseValidationService.js";

/** Reject excessive declared ZIP expansion before XLSX allocates inflated buffers.
 * Legacy XLS is not ZIP-based and remains bounded by the input and worker limits.
 * @param {Buffer} buffer
 */
function checkArchiveBudget(buffer) {
  if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) return;
  let end = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50 && offset + 22 + buffer.readUInt16LE(offset + 20) === buffer.length) { end = offset; break; }
  }
  if (end < 0) throw new Error("Invalid workbook archive");
  const entries = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  let expanded = 0;
  if (entries > 10000 || offset === 0xffffffff) throw new Error("Workbook archive is too large");
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid workbook archive directory");
    expanded += buffer.readUInt32LE(offset + 24);
    if (expanded > 64 * 1024 * 1024) throw new Error("Workbook archive exceeds expansion limit");
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
}

try {
  const fileBuffer = Buffer.from(workerData.fileBuffer);
  checkArchiveBudget(fileBuffer);
  const result = validateOfficialWorkbook({ ...workerData, fileBuffer });
  parentPort.postMessage(result);
} catch (error) {
  // The caller receives a safe rejection if parsing fails unexpectedly.
  throw new Error("Workbook validation could not complete", { cause: error });
}
