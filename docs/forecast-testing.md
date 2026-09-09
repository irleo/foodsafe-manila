# Manual forecast trial on GitHub Actions

This phase computes forecasts on `testing` and exports JSON. It does not dispatch
from uploads, change Render, start Express, register cron jobs, create prediction
jobs, or persist results. Production activation is a subsequent phase after the
trial succeeds.

## GitHub setup

1. In repository Settings → Environments, create `forecast-testing`.
2. Restrict its deployment branches to the selected branch `testing`.
3. Add the environment **secret** `TEST_MONGO_URI`. Use a dedicated MongoDB user
   with the `read` role on only the testing database, including an explicit database
   name in the URI. The worker also disables automatic index/collection creation.
4. Ensure the testing database contains a validated dataset, its official case
   records, cumulative source history, and threshold settings. Use sanitized test
   data: the artifact contains aggregate history and forecast output and is
   downloadable by users with repository read access. Public repository logs and
   artifacts must not contain confidential surveillance data.
5. Ensure the runner can reach MongoDB under your database network access policy.
   Standard hosted runners have changing outbound IPs. Do not broadly open the
   production database as a shortcut; resolve access for the test database first.
6. Commit and push the reviewed changes to `testing`. Manual dispatch requires the
   workflow file to exist on the repository's **default branch**. If that is already
   `testing`, pushing is sufficient. Otherwise, the workflow must also be registered
   there through a reviewed change; do not change the default branch casually.
   The job rejects any selected execution branch other than `testing`.

GitHub reference: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow

## First run

Open Actions → **Forecast testing (dry run)** → Run workflow. Select `testing`
and provide the validated dataset's `_id` from the testing database. No prediction
run ID, GitHub personal token, R2 secret, or production secret is required.

The data must have verified complete district coverage stored in MongoDB.
Historical datasets that depend on a local workbook path unavailable on the runner
need to be prepared in the testing environment before this trial.

The workflow installs the repository's pinned Prophet dependencies, runs districts
sequentially, and retains `forecast.json` and `summary.json` for three days.
Only one trial runs at a time. GitHub may replace an older pending run when another
is submitted; this concurrency setting is not a durable application job queue.

Download the artifact from the run page. Compare the target month, disease/district
coverage, point forecasts, backtest history, and thresholds with a local run on the
same testing data and code version. Prophet uncertainty intervals use sampling;
their bounds can vary between runs even with identical package versions. Do not
require exact interval equality. Previous saved forecasts can also affect backtest
reuse, so compare equivalent database snapshots.

`summary.json` records duration and model statuses. Model failures or zero successful
models fail the workflow after saving diagnostic artifacts. Insufficient-history
districts are reported separately; a green run does not imply complete city coverage.
Connection/setup failures may have no artifact. The process has a 30-minute overall
limit, a five-minute Python-process limit, and a 45-minute workflow limit.

For local execution, set `TEST_MONGO_URI`, `DATASET_ID`, `FORECAST_DRY_RUN=true`, and
`PYTHON_BIN` in your shell and run `node backend/scripts/runMonthlyForecastDryRun.js`
from the repository root. The worker does not load `.env` or fall back to `MONGO_URI`.
Output goes to ignored `forecast-artifacts/`; existing files are not overwritten.

After a successful trial, the next change can introduce durable job states,
production dispatch, retries/recovery, and a controlled switch from local execution.
