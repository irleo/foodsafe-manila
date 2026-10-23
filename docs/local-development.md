# Local Development

Commands below use PowerShell and start from the repository root unless a working directory is stated. They describe setup; they are not evidence of a fresh-clone verification. Dependency installation, test execution, and live integrations were not performed for this documentation update.

## Prerequisites

| Component | Prerequisite |
| --- | --- |
| Web and API | Node.js 22.12 or newer within Node 22, with npm; tracked lockfiles are installed using `npm ci` |
| Database | An isolated MongoDB development database; transaction-dependent citizen registration/recovery flows require a replica set or suitable Atlas deployment |
| Local forecasts | Python 3.12, a virtual environment, and the pinned Prophet/pandas/NumPy requirements |
| Mobile | Flutter with Dart satisfying `^3.10.0`, Android SDK tools, emulator or connected device |
| Integrations | Internet access and authorized development configuration for email, SMS, private R2, or remote Actions forecasts when exercising those features |

The unused root `package.json` and `package-lock.json` have been removed. Install and run `frontend` and `backend` separately using their own manifests and lockfiles; there is no root npm command. The legacy `mobile/backend/` API is deprecated; use the shared root `backend/`.

## Backend

For a new checkout:

```powershell
cd backend
npm ci
Copy-Item -LiteralPath .env.example -Destination .env
```

If `.env` exists, edit it instead of replacing it. Use [backend/.env.example](../backend/.env.example) as the configuration reference. Replace every `change-me-*` value with a distinct random local secret. Keep the file untracked and use a development database containing fictional/sanitized records.

| Variables | Purpose |
| --- | --- |
| `PORT` | API port, default `5000` |
| `MONGO_URI` | Development database URI; `MONGODB_URI` is a code fallback |
| `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` | JWT signing keys |
| `OTP_HASH_SECRET` | OTP proof hashing |
| `NODE_ENV` | Use `development` locally |
| `ALLOWED_ORIGINS` | Comma-separated exact frontend origins, such as `http://localhost:5173`; no paths/trailing slash |
| `REPORT_MAX_BACKDATE_DAYS` | Accepted reporting backdate window |
| `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME`, `BREVO_ACCESS_OTP_TEMPLATE_ID`, `BREVO_RESET_OTP_TEMPLATE_ID`, `BREVO_TIMEOUT_MS` | Email sender, templates, and request timeout |
| `SEMAPHORE_API_KEY`, `SEMAPHORE_SENDER_NAME`, `SEMAPHORE_SMS_API_URL` | SMS delivery; the sender must match the authorized provider configuration |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | Private workbook template/original storage |
| `FORECAST_EXECUTION_MODE` | `local` for local Python or `github` for configured remote workers |
| `PYTHON_BIN` | Python executable for local-mode forecasts |
| `PREDICTION_REFRESH_TIMEOUT_MS`, `PROPHET_PROCESS_TIMEOUT_MS`, `FORECAST_MODEL_CONCURRENCY` | Local prediction execution safeguards |
| `GITHUB_FORECAST_ENVIRONMENT`, `GITHUB_FORECAST_REPOSITORY`, `GITHUB_FORECAST_TOKEN` | Remote dispatch; follow the separate forecast rollout guide |

From `backend/`, start the API after configuring the database:

```powershell
npm run dev
```

Startup connects to MongoDB and initializes registered model collections/indexes before listening. Use a database account with the permissions needed for your isolated development database. No migration or seed command is part of this setup.

Check the process from another terminal:

```powershell
Invoke-RestMethod -Uri http://localhost:5000/api/health
```

This endpoint checks the responding process; it does not probe dependencies. To test staff features, arrange an approved development account with the project maintainer. Access requests use email verification and admin approval; there is no documented automatic admin bootstrap or guaranteed demo login. Empty databases have no analytics/forecast history until suitable official-format test data is imported.

## Local forecasting

The example environment selects `FORECAST_EXECUTION_MODE=local`. To exercise forecasting locally, install its dependencies into an isolated environment. From the repository root:

```powershell
python -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -r backend/services/prophet/requirements.txt
$env:PYTHON_BIN = (Resolve-Path .\.venv\Scripts\python.exe).Path
cd backend
npm run dev
```

Use a Python 3.12 interpreter for the first command; verify `python --version` beforehand. The explicit executable avoids PowerShell activation-policy changes. `PYTHON_BIN` applies to the current terminal and its child processes; set it again in a new terminal or configure its absolute path in your private backend `.env`. Bash equivalents use `.venv/bin/python`.

The requirements file pins Prophet, pandas, and NumPy. The sample concurrency is one. Uploads and manual refreshes can invoke Python; the monthly fallback runs only in local mode. These operations require enough valid official history and are distinct from the lightweight synthetic regression tests.

For remote execution, follow [forecast deployment](forecast-production.md) and [testing trials](forecast-testing.md). Use only the explicitly configured testing database/environment for development. The Node-only Render build expects GitHub mode and does not install these local Python packages.

## Frontend

In another terminal, from the repository root:

```powershell
cd frontend
npm ci
Set-Content -LiteralPath .env -Value 'VITE_API_BASE_URL=http://localhost:5000'
npm run dev
```

Edit an existing `.env` instead of overwriting it. Use Vite's printed origin in backend `ALLOWED_ORIGINS`. The frontend API setting must omit `/api`, since request paths already include it. Restart Vite after environment changes. Browser-exposed `VITE_*` values must never contain secrets.

See the [frontend guide](../frontend/README.md) for routing, hooks, charts, maps, and commands.

## Mobile

From the repository root:

```powershell
cd mobile
flutter doctor
flutter pub get
flutter devices
flutter run
```

Debug builds default to `http://10.0.2.2:5000/api` for the Android emulator. A physical device must reach the development machine on its LAN address:

```powershell
flutter run --dart-define=API_BASE_URL=http://192.168.1.100:5000/api
```

Replace the example address with your machine's address. Desktop, browser, and iOS simulator development also need the appropriate reachable URL override rather than assuming Android emulator networking. Mobile URLs include `/api`, unlike the frontend origin setting. Maps/location require the relevant network access, permissions, and device location services.

Release builds require an explicit API URL; configure production signing before distribution. See the [mobile guide](../mobile/README.md) for platform limits and release details.

## Integration readiness

- Health/authenticated reads can be checked separately from external delivery, uploads, and forecasts. Missing provider credentials are not replaced by a supported mock delivery service.
- Email/SMS workflows require functioning provider settings and may send real messages. Use authorized test recipients.
- Dataset template/download/import operations need a private R2 bucket, authorized object access, and `templates/FoodSafe_Template.xlsx`. Submit a validation preview before import.
- Local MongoDB transaction support matters for atomic account/policy/recovery operations; a standalone instance is insufficient for those workflows.
- Use simulated symptoms, fictional exposure details, and sanitized official-format fixtures. Never copy private surveillance records or real credentials into documentation or regression fixtures.

See [API documentation](api.md) and [test commands](testing.md) for the available verification paths.
