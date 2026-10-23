# FoodSafe Manila Deployment Overview

The monorepo contains a React staff dashboard, an Express API, a Flutter citizen app, and Python forecasting. The [architecture guide](architecture.md) covers data flow; this overview explains checked-in deployment boundaries.

## Hosting and execution

| Component | Configuration and responsibility |
| --- | --- |
| React | Render static service `foodsafe-frontend`; root `frontend`; build `npm ci && npm run build`; publish `dist`; SPA rewrite |
| Express | Render Node service `foodsafe-backend`; root `backend`; build `npm ci`; start `npm start` |
| Forecasting | Actions `forecast-job.yml` installs Python dependencies, claims a job, runs Prophet, saves to MongoDB |
| MongoDB | External database shared by the matching API and worker environment |
| R2 | Private template and original uploads; metadata in MongoDB |
| Brevo / Semaphore | Email/SMS delivery initiated by the API |
| Flutter | Distributed separately with its API URL supplied through a Dart definition |

Both Render services select `production` in [render.yaml](../render.yaml). The backend declares `plan: free` and no persistent disk. Older descriptions of an approved `1c-2g` upgrade do not match this configuration. Confirm live settings separately before describing actual capacity or cost.

The Node-only Render build requires `FORECAST_EXECUTION_MODE=github`; it does not install Prophet. Local Python remains a development/rollback option after restoring and verifying that environment. The registered monthly cron skips GitHub mode. Remote forecasts are driven by uploads and manual refreshes.

## Client configuration

The frontend receives build-time `VITE_API_BASE_URL`, using the backend origin without `/api`. Mobile receives `API_BASE_URL` and requires the `/api` suffix. Neither client receives database credentials, OTP secrets, or provider keys.

The Blueprint lists frontend domains `foodsafe-manila.online` and `www.foodsafe-manila.online`. Backend `ALLOWED_ORIGINS` must allow the actual browser origins. If the API hostname changes, update the frontend API setting and Blueprint CSP `connect-src` together, then rebuild. DNS ownership and live domain verification are operational settings outside this repository.

## Release strategy and activation

Both services declare `autoDeployTrigger: checksPass`. The intended process is a feature branch, PR into `production`, passing checks, reviewed merge, and deployment of the merged commit. [FoodSafe CI](../.github/workflows/ci.yml) defines frontend, backend, and synthetic forecasting jobs for PRs targeting `production` and pushes to `production`. Flutter checks remain local. Operational forecast workflows remain separately dispatched.

Publish the workflow, observe its actual results, and configure required checks and PR protection before treating this gate as complete. A local workflow file does not establish that a GitHub run succeeded or a repository ruleset is active. Render does not automatically deploy a commit with no detected checks under **After CI Checks Pass**. See [Render CI integration](https://render.com/docs/deploys#integrating-with-ci) and the [deployment guide](ci-cd-deployment-guide.md).

Render checks new web instances before sending them traffic. `/api/health` confirms that Express responds; it does not establish database or forecast readiness. Verify an authenticated data view and completed forecast separately. See [Render health checks](https://render.com/docs/health-checks).

## Operational limits

- The Blueprint's Free backend may spin down when idle. Confirm cold-start behavior and availability expectations separately. See [Render Free services](https://render.com/docs/free).
- New workbook retention uses R2. Historical local-path downloads require their original files to remain available on an ephemeral host.
- API and worker credentials must select the same intended database. Follow the branch/environment safeguards in [forecast rollout](forecast-production.md).
- Imports and forecasts have separate success states. An imported dataset may still have a queued or failed forecast.
- Code rollback does not undo MongoDB records or R2 objects. Preserve compatible schemas and API contracts. Database resets are not routine release steps.
- Local execution uses process-local coordination; remote execution uses persisted jobs and worker claims. Review the active mode before scaling.

## Release verification

Before release, review the exact commit, actual CI results, live Render settings, environment pairing, and rollback target. After deployment, verify `/api/health`, staff login, a database-backed view, authenticated template/download access, and the changed feature. Forecast changes also require a sanitized testing run and eligible saved output. These are verification steps, not claims that the live deployment has passed them.
