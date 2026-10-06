import { logServerError } from "../utils/serverLogger.js";

/** A committed import stays successful if a follow-up action fails.
 * @param {() => Promise<unknown>} action @returns {Promise<void>}
 */
export async function afterDatasetSave(action) {
  try {
    await action();
  } catch (error) {
    logServerError(error, { code: "DATASET_POST_SAVE_FAILED", route: "dataset:upload" });
  }
}
