import { Worker } from "node:worker_threads";

let active = false;
/** @param {string} message */
const rejection = (message) => ({
  success: false, canUpload: false, reason: message, normalized: [],
  errorCount: 1, warningCount: 0, validRowCount: 0, totalRows: 0,
  errors: [{ sheet: null, row: null, field: "workbook", message }], warnings: [], validRecords: [], worksheets: [],
});

/** Isolate untrusted parsing and bound concurrent memory use.
 * @param {{fileBuffer: Buffer, declaredCoverageStart?: Date, declaredCoverageEnd?: Date}} options
 * @returns {Promise<ReturnType<import('./officialCaseValidationService.js').validateOfficialWorkbook>>}
 */
export async function validateWorkbookIsolated(options) {
  if (active) return rejection("Another workbook is being validated. Please retry shortly.");
  if (!Buffer.isBuffer(options.fileBuffer) || options.fileBuffer.length > 25 * 1024 * 1024) return rejection("Select an Excel workbook no larger than 25 MB.");
  active = true;
  let worker;
  let timeout;
  try {
    return await new Promise((resolve) => {
      worker = new Worker(new URL("./workbookValidationWorker.js", import.meta.url), {
        workerData: options, execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 },
      });
      timeout = setTimeout(() => resolve(rejection("Workbook validation exceeded 30 seconds. Split the workbook and retry.")), 30000);
      worker.once("message", resolve);
      worker.once("error", () => resolve(rejection("Workbook could not be validated within the supported resource limits. Check the file or split it into smaller workbooks.")));
      worker.once("exit", () => resolve(rejection("Workbook validation stopped before completion. Please retry with a smaller workbook.")));
    });
  } catch (error) {
    return rejection("Workbook validation could not start. Please retry.");
  } finally {
    clearTimeout(timeout);
    try {
      if (worker) await worker.terminate();
    } finally {
      active = false;
    }
  }
}
