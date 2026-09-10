# Manual forecast trial on GitHub Actions

## Performance comparison

GitHub testing workflows set `FORECAST_MODEL_CONCURRENCY=2`; local API execution
defaults to one. The cap is two and district result ordering is preserved. Set the
workflow value to `1` for a sequential comparison using the same implementation.
Per-disease data preparation and per-district Prophet/threshold timings appear as
`[forecast-timing]` lines. Per-model durations overlap with concurrency enabled, so
do not sum them as wall-clock duration; use the existing whole-run `durationMs`.

An explicit Python `backtestMonths: 0` now stays zero instead of becoming 19.
Validated historical results are still reused only for an exact historical prefix;
revised history still requests full recomputation. Forecast threshold calculations
reuse the current run's authoritative disease rows and coverage. Prophet parameters,
the 19-origin evaluation window, baseline exclusions, city aggregation, and interval
formulas are unchanged. Sampled interval bounds can differ across executions.

For a before/after comparison use the same dataset/database snapshot and input code
methodology. Start a new manual dry run after pushing the code; rerunning an already
successful automatic job intentionally skips computation. Compare total runtime,
requested/calculated backtest counts, target dates, all model statuses, point values,
and threshold values. No measured speedup is claimed until this remote run completes.

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

## Second trial: save to the testing database

The separate **Forecast testing (save to database)** workflow computes the forecast,
requires successful output for every supported disease and all six districts,
inserts a new `predictionRuns` record, and reads it back using the API's forecast
eligibility check. Existing successful records are preserved. This phase does not
add upload dispatch or change application scheduling.

In the same `forecast-testing` GitHub environment, add:

| Setting | Kind | Value |
| --- | --- | --- |
| `TEST_FORECAST_WRITE_MONGO_URI` | Secret | Connection URI for a dedicated user on the testing database |
| `TEST_FORECAST_DB_NAME` | Variable | Exact database name contained in that URI |

Keep `TEST_MONGO_URI` read-only for the original dry run. Give the new user read
access to the testing dataset/history/configuration collections and `find`/`insert`
access to `predictionRuns`. A custom role is preferable; a `readWrite` role restricted
to the testing database is broader. No production access, deletion, index changes,
or database migration is needed. Automatic collection/index creation is disabled;
use the already initialized testing database. The database-name check catches a
mismatched URI but cannot prove a database is non-production: configure both values
for the actual isolated testing database.

Push the reviewed files to `testing` and ensure this new workflow is also present
on the default branch as described above. Run **Forecast testing (save to database)**,
select `testing`, provide the dataset ID used for the dry run, and check **Save a new
forecast to the testing database**. Both trial workflows share the same concurrency
group. The write secret is supplied only to the compute step.

Download the verification summary after success. It must contain
`verifiedReadBack: true` and a `predictionRunId`. Open the testing app connected to
the same database, select the same dataset, and reload Predictions. If this is not
the latest dataset, explicitly select it; the default API view uses the latest
validated CESU dataset. The app/backend must use the matching testing code schema.
An authenticated `GET /api/predictions?datasetId=<datasetId>` should return
`hasPrediction: true` and the matching `predictionRunId`, unless a newer run has
since been saved. Viewing results does not require clicking the refresh button.

Read-back verification is automated; the live app check still needs to be performed.
The summary contains IDs and timing, not the complete case history.

A re-run of the same GitHub workflow run uses the same record ID and verifies the
existing result without inserting another record. A new **Run workflow** invocation
creates a new record. Failure before saving leaves no database job; GitHub is the
execution-status source for this manual phase. If the database committed a result
but the runner lost its response, retry the same run to verify it.

The worker deliberately does not expose a `running` database record: the current
API assumes running jobs belong to local Python execution and may attempt to resume
them. Do not treat this manual trial as the final distributed-job design. Avoid
uploading or refreshing the same testing dataset during this check so that a local
worker does not replace which result appears newest.

After the write trial and app verification, the next change can introduce shared
job ownership, durable queued/running/failed states, automatic dispatch and recovery,
and a controlled switch from local execution.

## Third trial: automatic dispatch from the testing API

The testing backend can now dispatch `.github/workflows/forecast-testing-auto.yml`
after a validated upload. The new upload's ID is the cumulative-history anchor,
matching the latest-dataset scope requested by the Predictions page.

### Configuration and rollout

1. Commit/push the reviewed code to `testing`, register the new manual-dispatch
   workflow on the default branch if necessary, and deploy the matching testing
   backend. Keep production `FORECAST_EXECUTION_MODE=local` (also the default).
2. In GitHub, create a fine-grained token restricted to this repository with
   **Actions: read and write** permission. Put it in the **testing backend's**
   environment as `GITHUB_FORECAST_TOKEN`, not in the frontend. The dispatch API
   requires Actions write permission:
   https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event
3. Set these on the testing backend:

   ```text
   FORECAST_EXECUTION_MODE=github
   GITHUB_FORECAST_REPOSITORY=irleo/foodsafe-manila
   GITHUB_FORECAST_TOKEN=<fine-grained token>
   ```

4. The API's `MONGO_URI` and the GitHub environment's
   `TEST_FORECAST_WRITE_MONGO_URI` must address the same isolated testing database.
   Keep `TEST_FORECAST_DB_NAME` configured in the GitHub environment. Extend the
   worker user's custom role to include **update** on `predictionRuns`, in addition
   to find/insert and read access to input data. A testing-database readWrite user
   already has the necessary permissions.
5. Retain the environment restriction to `testing`. Any required environment
   reviewer must approve each automatic job before it can execute. Long approval
   or GitHub queue delays count toward the job's 45-minute deadline.

No Render build changes or index migrations are performed by this patch. The
existing `predictionRunsActiveScopeUnique` partial unique index must exist in the
testing database; it protects active jobs. No new index is added. Optional ownership
fields are backward compatible with old records, which remain local by default.

### Expected behavior

Upload one valid testing workbook and open Actions → **Forecast testing (automatic
job)**. The upload remains successful even if dispatch fails; inspect Predictions
for the forecast outcome. Dispatch has a ten-second network timeout.

The backend inserts a job under `status: running`, `executionBackend: github`,
`executionPhase: queued`. Keeping the existing status protects the queue window
with the existing unique index and preserves frontend polling compatibility.
The worker atomically claims that record (`executionPhase: executing`), computes
using accumulated history, validates complete disease/district output, and updates
the same job to `status: success`, `executionPhase: finished`. Errors after claim
mark that owned job failed. Predictions retains the prior successful forecast while
polling and switches to the new record after success.

The API reports GitHub-owned active jobs as `workerActive: true` to prevent the
frontend's local-resume request. That compatibility flag means managed remotely;
use `executionPhase` to distinguish queued from executing. Even a direct refresh
request will not launch local Python for an existing GitHub-owned job.

Remote refreshes currently support only a one-month horizon. The in-process monthly
cron skips local execution in GitHub mode; this testing phase is upload/manual driven.
Production mode preserves the existing monthly cron.

### Verification and recovery

- Confirm upload, database job, GitHub job, and Predictions response share the same
  `basisDatasetId`/dataset scope and `predictionRunId`.
- A duplicate dispatch cannot claim an executing job. A duplicate workflow for an
  already successful job exits without recomputation. Different dataset jobs have
  independent concurrency groups, avoiding discarded pending uploads.
- Dispatch rejection fails an unclaimed job. An ambiguous dispatch failure does
  not mark an already claimed worker failed. No blind dispatch retry is attempted.
- Dependency/setup failures or a hard runner termination can leave an active job.
  On the next Predictions read for its scope (or next dispatch for that scope), an
  expired job is marked failed. The deadline is 45 minutes from creation, including
  queue/setup time; the worker also has a 30-minute computation timeout. Expired,
  failed, or differently owned jobs cannot publish a late result.
- After failure, use the app's forecast refresh to create a new GitHub job. Do not
  manually dispatch this workflow with an invented job ID. A dead claimed job
  remains locked until its deadline; it is not automatically reclaimed.
- Before switching the testing backend back to local mode, let remote jobs finish
  or expire. Existing GitHub jobs remain recognized as remote even after rollback.

The GitHub network call and database writes have not been executed from this local
implementation task. The upload-to-display test requires these environment settings
and the published workflow/backend.
