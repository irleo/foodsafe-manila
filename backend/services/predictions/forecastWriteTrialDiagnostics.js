// @ts-check

const messages = Object.freeze({
  INVALID_EXECUTION: "Run the confirmed write workflow from the testing branch in GitHub Actions.",
  MISSING_WRITE_URI: "Add TEST_FORECAST_WRITE_MONGO_URI under forecast-testing Environment secrets.",
  MISSING_DATABASE_NAME: "Add TEST_FORECAST_DB_NAME under forecast-testing Environment variables (not secrets).",
  INVALID_DATABASE_NAME: "TEST_FORECAST_DB_NAME must name the testing database, not a MongoDB system database.",
  INVALID_DATASET_ID: "Enter the dataset's 24-character ObjectId, without quotes or ObjectId(...).",
  DATABASE_MISMATCH: "The URI's database name does not match TEST_FORECAST_DB_NAME. Check the database segment after the hostname.",
  DATASET_NOT_FOUND: "The configured testing database has no validated CESU dataset with the supplied ID.",
});

export class ForecastTrialSetupError extends Error {
  /** @param {keyof typeof messages} code */
  constructor(code) {
    super(messages[code]);
    this.code = code;
  }
}

/** @param {Record<string, string | undefined>} env */
export function readForecastTrialConfiguration(env) {
  const uri = env.TEST_FORECAST_WRITE_MONGO_URI?.trim();
  const expectedDatabase = env.TEST_FORECAST_DB_NAME?.trim();
  const datasetId = env.DATASET_ID?.trim();
  const runId = env.GITHUB_RUN_ID;
  const repository = env.GITHUB_REPOSITORY;
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REF !== "refs/heads/testing"
    || env.CONFIRM_TEST_WRITE !== "true" || !runId || !repository) {
    throw new ForecastTrialSetupError("INVALID_EXECUTION");
  }
  if (!uri) throw new ForecastTrialSetupError("MISSING_WRITE_URI");
  if (!expectedDatabase) throw new ForecastTrialSetupError("MISSING_DATABASE_NAME");
  if (["admin", "config", "local"].includes(expectedDatabase)) {
    throw new ForecastTrialSetupError("INVALID_DATABASE_NAME");
  }
  if (!datasetId || !/^[a-f\d]{24}$/i.test(datasetId)) {
    throw new ForecastTrialSetupError("INVALID_DATASET_ID");
  }
  return { uri, expectedDatabase, datasetId: datasetId.toLowerCase(), runId, repository };
}

/** Return only fixed diagnostic text, never driver messages/stack traces.
 * @param {unknown} error
 * @returns {string}
 */
export function safeForecastTrialDiagnostic(error) {
  if (error instanceof ForecastTrialSetupError) return `${error.code}: ${messages[error.code]}`;
  if (error !== null && typeof error === "object") {
    const details = /** @type {{code?: unknown, name?: unknown}} */ (error);
    if (details.code === 18) return "DATABASE_AUTHENTICATION: Check the write user's username/password and URL-encode special characters in the password.";
    if (details.code === 13) return "DATABASE_AUTHORIZATION: The write user needs read access to testing data and find/insert access to predictionRuns.";
    if (details.name === "MongoParseError") return "DATABASE_URI_FORMAT: Check the write secret's MongoDB connection-string format.";
    if (details.name === "MongoServerSelectionError") return "DATABASE_CONNECTION: Check the cluster address, availability, and network access for the runner.";
  }
  return "TRIAL_FAILED: Review the last reported stage. No raw error details are printed. If saving may have completed, retry the same workflow run to avoid duplicate records.";
}
