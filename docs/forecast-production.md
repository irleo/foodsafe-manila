# GitHub forecast deployment

## Shared worker

`forecast-job.yml` (Actions name **Forecast generation**) replaces
`forecast-testing-auto.yml`. It runs `runGitHubForecastJob.js` for both environments:

| API setting `GITHUB_FORECAST_ENVIRONMENT` | Execution branch | GitHub environment |
| --- | --- | --- |
| `testing` | `testing` | `forecast-testing` |
| `production` | `production` | `forecast-production` |

The branch/environment pairing is enforced in the workflow and worker before any
database connection. The environment setting is required; there is no fallback.
The repository already has a `production` branch; this setup uses that branch,
not `main`. Confirm the production Render backend deploys that branch before rollout.

## Configure GitHub first

1. Create `forecast-production`; restrict deployment branches to `production` only.
   Keep `forecast-testing` restricted to `testing` only.
2. In **each** environment add secret `FORECAST_MONGO_URI` and variable
   `FORECAST_DB_NAME`. Use that environment's database, with the exact database name
   in the URI. Do not place production credentials in repository-level secrets.
   The database-name check detects mismatches, not whether credentials were assigned
   to the wrong environment: independently verify both settings against the API DB.
3. Use a dedicated worker user with read access to input/history/settings collections
   and find/update access to the existing `predictionRuns` collection. No delete,
   schema migration, or index creation permission is needed. Check the existing
   active-scope unique index is present; do not blindly create or rebuild indexes.
4. Arrange approved network access from hosted runners to MongoDB. Do not open the
   production database to all IPs merely to make the workflow pass. Do not emit raw
   records or credentials into logs; check repository visibility and runner access
   policy before allowing production surveillance data to be processed there.
5. Publish the workflow on the repository default branch (required for dispatch
   registration) and on both execution branches through reviewed changes.
   Required environment approvals delay every automatic forecast; queue and approval
   time count toward the existing 45-minute job deadline.

The testing-only dry-run/write-trial workflows remain useful and are not obsolete.
They retain `TEST_MONGO_URI`, `TEST_FORECAST_WRITE_MONGO_URI`, and
`TEST_FORECAST_DB_NAME`. Do not delete those settings while retaining these tools.
The automatic worker uses only the new generic names; no production dry-run
artifact workflow is introduced.

## Configure the Render backend

First migrate testing to the new workflow and verify one fresh upload/refresh.
Deploy matching code to production with local execution still enabled, then set:

```text
FORECAST_EXECUTION_MODE=github
GITHUB_FORECAST_ENVIRONMENT=production
GITHUB_FORECAST_REPOSITORY=irleo/foodsafe-manila
GITHUB_FORECAST_TOKEN=<repository-scoped token with Actions read/write>
```

Testing uses `GITHUB_FORECAST_ENVIRONMENT=testing` with its own backend settings.
The backend's existing `MONGO_URI` is unchanged and must match the selected worker
database. Tokens belong only on the backend, never in frontend configuration.
No new frontend environment variables are required.

Coordinate backend deployment with the workflow rename: an old backend still
dispatches the removed filename. Let existing jobs complete before switching.
Keep Python/local deployment support for rollback until production verification.

## Verify and recover

- Request one forecast through the production app using an existing validated
  dataset (no need to delete or re-upload data). Confirm the Actions run uses
  `production` and `forecast-production`.
- Confirm the queued job is claimed, becomes successful, and the Predictions API
  returns the same dataset and predictionRunId. Verify targets and all districts.
- Re-dispatching a completed job skips compute; use a new app refresh to benchmark.
- uv caches installation packages; it does not alter Prophet methodology. Existing
  dependency pins, two concurrent districts, and all 19 backtest origins remain.
- GitHub mode currently supports uploads and manual refresh, with a one-month horizon.
  The monthly local cron is skipped in GitHub mode; no remote scheduled fallback has
  been added. Decide whether a scheduled fallback is needed before final cutover.
- Failed/expired work can be retried from the app. Never delete forecast records to
  unlock jobs. Existing remote jobs must finish or expire before rollback to
  `FORECAST_EXECUTION_MODE=local`; do not start competing workers.

Code preparation is not deployment. Production migration is complete only after
environment/network setup, reviewed publication, backend activation, and the live
upload/refresh-to-display check. No production database action is part of this patch.
