# FoodSafe CI/CD Deployment Guide

This guide describes the implemented [FoodSafe CI workflow](../.github/workflows/ci.yml), its activation, repository protection, and the Render deployment configuration. A workflow definition does not establish that checks passed or that live settings are enforced.

## Current state

- Both services in [render.yaml](../render.yaml) track `production` and declare `autoDeployTrigger: checksPass`.
- Frontend build: `npm ci && npm run build`. Backend build: `npm ci`; start: `npm start`.
- Backend Blueprint: `plan: free`, no persistent disk, health path `/api/health`. Verify actual live settings in Render; no paid upgrade is assumed.
- `ci.yml` defines PR/push quality checks. Forecasting workflows separately use `workflow_dispatch` for operational compute/testing.
- The unused root npm manifest and lockfile were removed. CI and Render use the separate frontend/backend manifests and lockfiles.
- Backend, frontend, Python, and Flutter regression suites exist. Neither Node package has a generic `npm test` script. See [test commands](testing.md).

## 1. Work on a feature branch

For a new change, start from an up-to-date `production` checkout with a reviewed working tree:

```powershell
git switch production
git pull --ff-only
git switch -c codex/short-description
```

For this documentation checkpoint, continue on `repo-cleanup`. Review `git status --short` and `git diff`, stage only intended files, and use a Conventional Commit such as `docs: document setup architecture and APIs`. Push when the checkpoint is ready and use a PR into `production`.

## 2. Understand and verify quality CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on PRs targeting `production` and pushes to `production`. The first checks proposed changes; the second gives Render results for the merged deployment commit. Feature-branch pushes trigger checks through an open PR, not a separate feature-branch push trigger. `testing` is not targeted by this quality workflow.

| Check name | Implemented work |
| --- | --- |
| `Frontend quality` | Node 22; `npm ci`; ESLint; all Node frontend regressions; production build; 10-minute timeout |
| `Backend quality` | Node 22; `npm ci`; JavaScript syntax checks; all Node backend regressions; 10-minute timeout |
| `Forecast regression` | Python 3.12 and pinned requirements; synthetic `unittest` checks; 15-minute timeout |
| `Mobile quality` | Flutter stable; dependency restore; `flutter analyze`; `flutter test`; 20-minute timeout |

All four jobs use Ubuntu 24.04. Node setup selects the current Node 22 release, satisfying Vite's 22.12 minimum. `npm ci` installs the application lockfiles, including development dependencies needed for lint/build. Python setup installs `backend/services/prophet/requirements.txt`. Flutter currently follows the stable channel; pin the verified local SDK version in a future workflow change for repeatable SDK selection.

The workflow uses stable job names, read-only repository permissions, dependency caches, bounded durations, and cancellation for superseded quality runs. It has no path filters and does not supply production secrets or invoke operational forecast jobs. Forecast workflows retain separate concurrency/environment controls.

Publish the feature branch and open a PR into `production` to observe the first run. Open **Checks**, inspect each job's failed step if necessary, and push fixes to the same branch. No green CI, test pass, or build result is claimed here; record actual results before making checks required.

## 3. Configure merge and deploy gates

1. Publish the CI workflow through a reviewed branch/PR, then observe its named checks.
2. In the repository's Rulesets settings, create an **Active** branch ruleset targeting `production`. Require a PR, restrict deletions, block force pushes, and leave the bypass list empty so administrators also follow the PR path. Leave **Restrict updates** off for this setup. Required approvals can be zero for solo maintenance or one when a teammate reviews; require conversation resolution. See [GitHub rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).
3. After the checks report, require `Frontend quality`, `Backend quality`, `Forecast regression`, and `Mobile quality` using their actual reported names. Select GitHub Actions as the expected source when available and require the branch to be up to date before merge. See [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
4. Verify live Render services track `production` and use **After CI Checks Pass**, matching the Blueprint.
5. Verify checks run on the merged commit too. Render does not automatically deploy if zero checks are detected or any check fails. See [Render CI integration](https://render.com/docs/deploys#integrating-with-ci).

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
