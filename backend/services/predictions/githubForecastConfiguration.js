// @ts-check

const messages = Object.freeze({
  INVALID_EXECUTION: "Use GitHub Actions on the branch matching FORECAST_ENVIRONMENT (testing or production).",
  MISSING_WRITE_URI: "Set FORECAST_MONGO_URI in the selected GitHub environment's secrets.",
  INVALID_DATABASE_NAME: "Set FORECAST_DB_NAME to the exact application database name, not a MongoDB system database.",
  DATABASE_MISMATCH: "The connected database does not match FORECAST_DB_NAME.",
  INVALID_DATASET_ID: "Supply a 24-character dataset ObjectId.",
  INVALID_JOB_ID: "Supply the existing queued prediction job's 24-character ObjectId.",
});

export class ForecastConfigurationError extends Error {
  /** @param {keyof typeof messages} code */
  constructor(code) {
    super(messages[code]);
    this.code = code;
  }
}

/** Fail closed before connecting; never fall back to the API's MONGO_URI.
 * @param {Record<string, string | undefined>} env
 */
export function readGitHubForecastConfiguration(env) {
  const environment = env.FORECAST_ENVIRONMENT;
  if ((environment !== "testing" && environment !== "production")
    || env.GITHUB_ACTIONS !== "true" || env.GITHUB_REF !== `refs/heads/${environment}`
    || !env.GITHUB_RUN_ID || !env.GITHUB_REPOSITORY) {
    throw new ForecastConfigurationError("INVALID_EXECUTION");
  }
  const uri = env.FORECAST_MONGO_URI?.trim();
  const expectedDatabase = env.FORECAST_DB_NAME?.trim();
  const datasetId = env.DATASET_ID?.trim();
  const jobId = env.PREDICTION_RUN_ID?.trim();
  if (!uri) throw new ForecastConfigurationError("MISSING_WRITE_URI");
  if (!expectedDatabase || ["admin", "config", "local"].includes(expectedDatabase.toLowerCase())) {
    throw new ForecastConfigurationError("INVALID_DATABASE_NAME");
  }
  if (!datasetId || !/^[a-f\d]{24}$/i.test(datasetId)) throw new ForecastConfigurationError("INVALID_DATASET_ID");
  if (!jobId || !/^[a-f\d]{24}$/i.test(jobId)) throw new ForecastConfigurationError("INVALID_JOB_ID");
  return { uri, expectedDatabase, datasetId: datasetId.toLowerCase(), jobId: jobId.toLowerCase(), runId: env.GITHUB_RUN_ID };
}

/** Only fixed diagnostics are safe for public runner logs. @param {unknown} error */
export function safeGitHubForecastDiagnostic(error) {
  if (error instanceof ForecastConfigurationError) return `${error.code}: ${messages[error.code]}`;
  if (error !== null && typeof error === "object") {
    const details = /** @type {{code?: unknown, name?: unknown}} */ (error);
    if (details.code === 18) return "DATABASE_AUTHENTICATION: Check the worker credentials.";
    if (details.code === 13) return "DATABASE_AUTHORIZATION: The worker needs read access to forecast inputs and find/update access to predictionRuns.";
    if (details.name === "MongoParseError") return "DATABASE_URI_FORMAT: Check FORECAST_MONGO_URI.";
    if (details.name === "MongoServerSelectionError") return "DATABASE_CONNECTION: Check database availability and runner network access.";
  }
  return "FORECAST_FAILED: Review the reported stage. Retry from the app after the job finishes or expires; never delete the job to retry.";
}
