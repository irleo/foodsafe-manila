# FoodSafe CI/CD Deployment Guide

This guide distinguishes checked-in deployment configuration from quality CI still to be implemented. This documentation update does not add a CI workflow.

## Current state

- Both services in [render.yaml](../render.yaml) track `production` and declare `autoDeployTrigger: checksPass`.
- Frontend build: `npm ci && npm run build`. Backend build: `npm ci`; start: `npm start`.
- Backend Blueprint: `plan: free`, no persistent disk, health path `/api/health`. Verify actual live settings in Render; no paid upgrade is assumed.
- Existing Actions workflows use `workflow_dispatch` for forecasting, not general PR/push correctness checks.
- Backend, frontend, Python, and Flutter regression suites exist. Neither Node package has a generic `npm test` script. See [test commands](testing.md).

## 1. Work on a feature branch

For a new change, start from an up-to-date `production` checkout with a reviewed working tree:

```powershell
git switch production
git pull --ff-only
git switch -c codex/short-description
```

For this documentation checkpoint, continue on `repo-cleanup`. Review `git status --short` and `git diff`, stage only intended files, and use a Conventional Commit such as `docs: document setup architecture and APIs`. Push when the checkpoint is ready and use a PR into `production`.

## 2. Add quality CI in Phase 3

The planned `.github/workflows/ci.yml` should run on PRs targeting `production` and pushes to `production`. The first checks proposed changes; the second gives Render results for the merged deployment commit. Add equivalent coverage for `testing` if that branch is also CI-gated.

| Check | Required work |
| --- | --- |
| Frontend quality | `npm ci`; ESLint; all current Node frontend regressions; production build |
| Backend quality | `npm ci`; all current Node backend regressions; JavaScript syntax checks |
| Forecast regression | Python 3.12 and pinned dependencies; synthetic Python `unittest` checks |
| Mobile quality | Flutter SDK satisfying Dart `^3.10.0`; dependency restore; `flutter analyze`; `flutter test` |

Use Node 22.12 or newer within Node 22, consistent with Vite's engine requirement. Install development dependencies for linting/building. Keep correctness checks independent of production secrets, live datasets, SMS/email delivery, and database-writing forecast trials. Do not dispatch operational forecast jobs as routine PR checks.

Use stable job names, read-only repository permissions, bounded durations, and cancellation for superseded quality runs. Avoid workflow-level path filters that prevent required checks from reporting. Forecast workflows have separate concurrency/environment controls and should retain their safeguards.

No green CI, test pass, or build result is claimed here. Run the implemented jobs and record actual results before making them required.

## 3. Configure merge and deploy gates

1. Publish the CI workflow through a reviewed branch/PR, then observe its named checks.
2. Configure the `production` ruleset or branch protection to require PRs and the observed checks. Agree on the approval requirement with the team and block force pushes/branch deletion as appropriate.
3. Verify live Render services track `production` and use **After CI Checks Pass**, matching the Blueprint.
4. Verify checks run on the merged commit too. Render does not automatically deploy if zero checks are detected or any check fails. See [Render CI integration](https://render.com/docs/deploys#integrating-with-ci).

Repository files do not prove branch protection or live settings are enabled; verify them during rollout.

## 4. Prepare the application release

1. Review the diff, actual test/build output, environment changes, and rollback target.
2. Verify MongoDB, JWT/OTP, Brevo, Semaphore, and R2 settings without copying secrets into docs or logs. Keep R2 private and the template at `templates/FoodSafe_Template.xlsx`.
3. Follow [forecast deployment](forecast-production.md): publish the worker, pair its branch/environment/database, and verify testing before production activation. Keep `FORECAST_EXECUTION_MODE=github` with the Node-only Render build.
4. Align the frontend API origin, backend CORS, and frontend CSP API allowlist. Mobile release builds require their own complete API URL ending in `/api`.
5. Preserve API/schema compatibility with the existing release. Any required migration/reset needs a separately reviewed, explicitly authorized procedure and recovery plan. Do not drop databases or collections as a routine deployment step.

## 5. Verify deployment

Inspect the Render deployment after merge and successful checks. Keep `/api/health` as the health path; its current response proves process responsiveness, not MongoDB or Prophet readiness. Render checks new instances before routing traffic. See [Render health checks](https://render.com/docs/health-checks).

Verify login, an authenticated database-backed page, the changed feature, and authorized template/original downloads. Confirm unauthenticated downloads are rejected. For forecast changes, inspect the worker run and a saved eligible prediction; a successful health response alone is insufficient.

Use sanitized data for import/report smoke tests and agree on production writes beforehand. Review application logs without sharing raw records or secrets. The checked-in Free backend may sleep while idle; confirm cold-start behavior separately. See [Render Free services](https://render.com/docs/free).

## 6. Recovery

Identify the affected frontend/API version and available previous deploy in Render. Verify the plan's available rollback history before release. Preserve compatible contracts so services can be recovered independently where possible.

Code rollback does not reverse MongoDB writes, schema changes, or R2 objects. Do not attempt ad hoc database resets to repair a deployment; data restoration requires a separate approved recovery procedure.

Before switching remote forecasting to local execution, restore and verify Python dependencies as described in [forecast deployment](forecast-production.md). After recovery, recheck API responsiveness, authentication, affected views, and live auto-deploy settings.
