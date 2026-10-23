# Existing Checks and Test Commands

This guide documents the current checks. It does not claim they passed during the documentation update. See [local setup](local-development.md) for tool versions and dependencies. Project execution rules require approval before running local suites or installing dependencies; listing a command here is not permission for an agent to execute it.

## Frontend

From `frontend/`:

```powershell
npm run lint
npm run build
node --test "tests/*.test.js"
```

The Node suite covers error disclosure, the official/citizen analytics boundary, auth refresh, and threshold request caching. Focused package scripts are `test:errors`, `test:analytics-boundary`, and `test:auth-refresh`. These are helper/regression checks, not complete browser, accessibility, or screenshot tests.

## Backend

From `backend/`:

```powershell
node --test "tests/*.test.js"
```

The suite includes auth/session security, OTP/recovery, policy/consent, report workflows, workbook preview/import boundaries, case normalization, analytics, caching, forecasting dispatch/output, and error disclosure. Tests use mocks, synthetic data, and in-process HTTP fixtures where needed. This is not a live MongoDB/provider/Render end-to-end verification.

Focused package scripts are `test:errors`, `test:analytics-boundary`, `test:reports-auth`, and `test:p1-defects`. They cover subsets; there is no generic `npm test` script. Use the all-files command to include regression files that are not listed in package scripts.

For a single JavaScript syntax check without executing a suite:

```powershell
node --check server.js
```

## Python forecasting regressions

From the repository root, after installing dependencies into `.venv`:

```powershell
& .\.venv\Scripts\python.exe -m unittest discover -s backend/tests -p 'forecast_monthly_*_test.py'
```

The alignment/options tests use synthetic inputs and stub fits or inspect source behavior. The alignment checks import pandas. They do not run full live Prophet jobs or verify production model performance. The filename pattern is important: default `unittest` discovery uses `test*.py`, which does not match the current filenames.

## Flutter

From `mobile/`, after `flutter pub get`:

```powershell
flutter analyze
flutter test
```

Current checks include auth/OTP flows, session handling, reporting confirmation, recovery/phone change, policy screens, location behavior, and responsive screen layouts. Service/widget checks do not establish real-device GPS, notification delivery, SMS/email delivery, or release-signing correctness. Those need separate device/integration verification.

## Operational forecast trials and load checks

[Forecast testing](forecast-testing.md) documents separate dry-run and database-writing trials against explicitly configured testing databases. [Forecast deployment](forecast-production.md) covers the shared worker and environment safeguards. These are operational checks with database/network access, not ordinary PR unit tests.

The `load-tests/` k6 scenarios and [project notes](../DOCU.md#load-testing) document workload testing. Keep load checks on an authorized nonproduction target; they do not replace correctness checks. Do not run a database-writing trial or production load test as part of a routine documentation validation.

General PR/push CI remains Phase 3 work. The existing Actions workflows are dispatch-based forecasting jobs.
