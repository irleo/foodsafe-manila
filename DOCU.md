# FoodSafe Manila Project Status

Updated on: 2026-08-03

## Overall Project Purpose

FoodSafe Manila is a foodborne illness monitoring platform for Manila. It combines:

- A web admin dashboard for health officials and analysts.
- A backend API that stores official case data, citizen reports, analytics, heatmap data, notifications, users, and prediction runs.
- A Flutter mobile app for citizens to register, submit suspected foodborne illness reports, view alerts, inspect nearby risk, and see analytics.

The backend is the source of truth. Both the React frontend and Flutter app call the same Express/MongoDB API on port 5000.

## Changes Implemented on 2026-08-03

### User Models and MongoDB Collections

- Web accounts now use `backend/models/WebUser.js`, the Mongoose model name `WebUser`, and the explicit MongoDB collection `web_users`.
- Mobile accounts now use `backend/models/MobileUser.js`, the schema variable `mobileUserSchema`, the Mongoose model name `MobileUser`, and the explicit MongoDB collection `mobile_users`.
- References were updated accordingly: web approval/audit references use `WebUser`, while citizen reports reference `MobileUser`.
- The active database remains selected through `MONGO_URI` (with `MONGODB_URI` as a fallback), so test and production databases can be changed without code edits.

### Mobile Phone Number Input

- Login, registration, and password-reset phone fields show the `+63` prefix before focus.
- Users enter exactly the ten digits after `+63`, starting with `9`; the UI formats the value as `917 123 4567` and prevents input beyond ten digits.
- Helper and validation text explicitly explain the accepted format.
- API requests normalize the displayed number to the backend's local `09XXXXXXXXX` representation.

### Mobile OTP and Semaphore SMS

- PhilSMS integration and configuration were removed.
- The backend generates a cryptographically random six-digit OTP, hashes it with HMAC-SHA256 using `OTP_HASH_SECRET` (falling back to `ACCESS_TOKEN_SECRET`), and never stores the plaintext code.
- Semaphore sends the already-rendered message through the regular `POST /api/v4/messages` endpoint. The dedicated Semaphore OTP endpoint is intentionally not used because FoodSafe owns OTP generation and verification.
- Semaphore configuration uses `SEMAPHORE_API_KEY`, optional `SEMAPHORE_SENDER_NAME`, and `SEMAPHORE_SMS_API_URL`.
- OTPs expire after five minutes, have a 60-second resend cooldown, and allow at most five incorrect verification attempts.
- Successful verification returns a one-time hashed verification token that expires after ten minutes and must be consumed by registration or password reset.
- Send and verification routes also have IP-based Express rate limits: five sends and twenty verification attempts per 15-minute window.

### Web Session Availability Checks

- The React auth provider validates an authenticated web session through `GET /api/users/me` every 60 seconds.
- Each heartbeat has a five-second timeout. An unreachable backend or failed validation clears the in-memory web authentication state, causing protected routes to return to the public flow.
- A visible-tab event triggers an immediate session check instead of waiting for the next interval.
- A 401/403 heartbeat first attempts the refresh-token flow before signing the user out.
- Web logout clears local React authentication in a `finally` block, even when the backend logout request cannot be completed.
- The heartbeat is a UI/session-availability check, not server-side token revocation. An abruptly stopped backend cannot clear an existing HTTP-only refresh cookie in the browser.

## Fully Implemented Features and Modules

### Backend Core

- Express API server with JSON parsing, CORS allowlist, cookie parsing, API rate limiting, auth-specific rate limits, root health response, 404 handling, and global error handling.
- MongoDB connection setup through Mongoose with configurable bounded connection-pool defaults for the Render Starter tier.
- Slow-request timing and periodic process-memory instrumentation that omit query strings and sensitive request data.
- JWT bearer-token middleware and role-based admin guard.
- Central route registration for auth, users, reports, datasets, analytics, cases, heatmap, activity, notifications, health, predictions, and mobile-facing endpoints.

### Web Admin Authentication and Access

- Admin/user login with email and password.
- Refresh-token cookie flow for web sessions.
- Logout endpoint.
- Access request workflow with OTP email verification.
- Password reset workflow with OTP verification and password validation.
- Pending/approved/rejected account gate before login and token refresh.

### Mobile User Authentication

- Mobile user registration with phone number and verified OTP token.
- Mobile user login through the shared `/api/auth/login` route when a `phone` field is supplied.
- Mobile refresh-token endpoint for mobile sessions.
- Mobile password reset by phone number and verified OTP token.
- Mobile profile update with ownership checks.

### User Management

- Admin-only user listing with pagination, status filter, and search.
- Admin-only status counts.
- Admin-only approval/rejection of non-admin users.
- Admin-only deletion of non-admin users.
- Current user profile lookup.

### Official Dataset Uploads

- XLSX upload flow for official case data.
- Detection of raw health office workbook format and processed template format.
- Template download endpoint for official case uploads.
- Normalization into weekly or explicitly legacy-monthly `OfficialCase` rows with institutional provider, ingestion method, epidemiological year/week, calendar month, classification, and case count.
- Dataset metadata persistence, including coverage dates, format type, diseases, districts, row counts, validation errors, and status.
- Dataset list and dataset file download endpoints.
- Upload success/failure notifications and activity log entries.
- Automatic non-blocking monthly prediction refresh after successful official XLSX upload.

### Citizen Reports

- Citizen report creation with location, reporter district, optional exposure district/barangay, symptoms, food source, reported date, and case count.
- Input validation for Manila districts, coordinates, symptoms, case count, and future dates.
- Duplicate suppression window for similar user reports.
- Report log retrieval for admins.
- Per-user report history and latest report timestamp retrieval.
- Unusual report notification when a district crosses the configured 24-hour threshold.

### Analytics and Cases

- Dataset-scoped official case listing.
- Dataset-scoped analytics summary with totals, available filters, year-over-year stats, monthly cases, cases by disease, cases by district, cases by classification, district statistics, and risk donut data.
- Shared statistics builder services for backend analytics.

### Heatmap and Risk

- Dataset-scoped district/barangay heatmap endpoint with year, month, disease, and case-classification filters.
- District average incident calculation and Low/Medium/High/Critical bands.
- Disease stats and filter options returned with heatmap payloads.
- Mobile risk heatmap combining official cases and counted citizen reports.
- Mobile nearby risk endpoint by barangay number or coordinates.
- Coalesced TTL caching for citywide risk snapshots and barangay-specific nearby-risk results.
- Nearby-risk lookups select the requested barangay and top citywide alerts from one shared snapshot, avoiding a second database aggregation.
- Cached mobile dashboard summaries to avoid repeating the same MongoDB aggregations for every client.

### Predictions

- Prophet is the sole operational monthly district forecasting method. If Prophet cannot produce a valid target forecast, that district remains unavailable; no alternate model is substituted.
- Seasonal Naïve (the same calendar month one year earlier) is retained only as a historical benchmark and never supplies an operational forecast.
- Monthly preprocessing generates every district-month inside the verified dataset coverage period; a covered month without a confirmed record is stored as zero for modeling, while months outside coverage remain missing.
- Prophet and Seasonal Naïve use the same completed confirmed-case series and comparable rolling-origin backtest targets.
- Prophet requires at least 24 complete training months. Up to 19 recent rolling-origin one-step forecasts are retained for operational error charts, benchmark comparison, and aggregate-interval calibration.
- District-level 95% prediction intervals come from Prophet's posterior-predictive lower and upper quantiles. A zero lower endpoint means the interval is bounded by zero cases, not that uncertainty is zero.
- The Whole-Manila point forecast is coherent and bottom-up: it is the sum of all six district Prophet point forecasts. Whole-Manila output is unavailable unless all six districts have valid Prophet target forecasts.
- Whole-Manila district bounds are never added. When at least 19 common rolling-origin aggregate errors are available, the 95% interval uses the corrected empirical 95th percentile of absolute errors from the same bottom-up Prophet pipeline: `max(0, pointForecast - radius)` to `pointForecast + radius`. Otherwise, the interval is explicitly stored and displayed as not calculated.
- Prediction runs use schema version 9 and are stored in MongoDB with model, granularity, dataset scope, basis period, forecast target period, trigger, status, payload methodology, calibration status, and coverage metadata.
- Manual admin refresh endpoint.
- Automatic refresh after official upload.
- Prediction retrieval endpoint with optional district filtering.
- Backtest and forecast payloads exposed to the frontend.
- Prediction generated notifications.
- A process-wide forecast queue that coalesces duplicate jobs and allows only one forecast refresh at a time.
- Sequential district Prophet execution so the backend runs no more than one Python forecast child process at a time.
- Forecast queue-wait and execution-duration logging for Starter-tier monitoring.

### Notifications and Activity

- Notification listing.
- Mark notification read/unread.
- Mark all notifications read.
- Notification creation service used by access requests, reports, dataset uploads, prediction runs, and password resets.
- Activity log creation for important backend events and dashboard recent-activity display.

### React Admin Frontend

- Vite/React app with protected and public routing.
- Public welcome, login, request access, forgot password, and reset password screens.
- Protected dashboard layout with navbar/sidebar.
- Dashboard, analytics, heatmap, predictions, data, and admin-only user management pages.
- Dataset upload UI, recent datasets list, report logs tab, analytics charts, heatmap map/control/stat components, notification dropdown, and prediction charts.
- API wrappers and hooks for datasets, heatmap, reports, official cases, predictions, latest dataset id, and authenticated Axios usage.
- Visibility-aware notification polling: the default interval is 60 seconds, hidden tabs do not poll, and polling resumes immediately when the tab becomes visible.
- A 60-second authenticated-session heartbeat with a five-second timeout and immediate validation when a tab becomes visible.

### Flutter Mobile App

- Mobile app shell with persisted session initialization, session warmup, notification initialization, location preload, and risk monitoring startup.
- Login, signup, forgot password, dashboard/home, analytics, alerts, map, report form, report history, profile, and personal information screens.
- API client with bearer token attachment and automatic refresh on 401/403.
- Services for API access, session storage, local notifications, location, Manila geo lookup, heatmap risk, alerts, OTP flow, and risk alerts.
- Shared assets for logo and Manila barangay geo data.
- Risk monitoring prevents overlapping GPS/API checks when a previous 45-second interval request is still running.
- Shared Philippine mobile-number prefix, formatting, length limiting, and validation components for authentication screens.
- Registration and password-reset OTP screens backed by the backend's Semaphore SMS flow.

## Render Starter Performance Controls

The backend is configured for the Render Starter instance in `render.yaml`. The frontend remains a Render Static Site. The following controls reduce CPU, memory, database, and outbound-request pressure on the 512 MB backend instance.

### Risk and Dashboard Caches

- `GET /api/risk/heatmap` reuses a citywide risk snapshot instead of recalculating all barangays for every request.
- `GET /api/risk/nearby` selects and caches the requested barangay from the shared citywide snapshot and reuses its high-risk alerts.
- `GET /api/dashboard` reuses a cached annual dashboard summary.
- Identical requests arriving while a cache value is being calculated share the same in-flight promise instead of starting duplicate MongoDB aggregations.
- Caches are in-process and intentionally short-lived. They are suitable for the single-instance Starter deployment. A future multi-instance deployment requires a shared cache or precomputed MongoDB snapshot.

Default cache settings:

```env
RISK_CACHE_TTL_MS=60000
DASHBOARD_CACHE_TTL_MS=120000
```

### Prophet Resource Protection

- Monthly and legacy yearly prediction refreshes share one process-wide queue.
- A matching queued or active job is reused rather than duplicated.
- Different jobs wait for the active job to finish.
- District forecasts run sequentially instead of through `Promise.all`.
- The queue logs wait time and total refresh duration.

This protects the Express API from multiple simultaneous Python/Prophet processes. The lock is process-local and matches the current single-instance Starter architecture. If the backend is horizontally scaled later, replace it with a MongoDB-backed distributed job lock or a separate worker.

### MongoDB Pool Defaults

The backend uses conservative defaults that can be overridden without code changes:

```env
MONGO_MAX_POOL_SIZE=10
MONGO_MIN_POOL_SIZE=1
MONGO_SERVER_SELECTION_TIMEOUT_MS=10000
```

The final pool size should be validated against the selected Atlas tier and measured request concurrency.

### Performance Logging

Slow API requests are logged without query strings so coordinates, filters, and tokens are not exposed. Process memory and forecast queue state are logged periodically.

```env
PERF_SLOW_REQUEST_MS=1000
PERF_SLOW_CACHE_MS=500
PERF_MEMORY_INTERVAL_MS=300000
PERF_MEMORY_MONITOR=true
PERF_LOG_ALL_REQUESTS=false
PERF_LOG_CACHE=false
```

### Client Request Controls

The React notification poll interval defaults to 60 seconds and is configurable at frontend build time:

```env
VITE_NOTIFICATION_POLL_MS=60000
```

The Flutter risk service retains the existing 45-second interval but skips an interval when the previous location/API check has not completed.

The React web session heartbeat runs every 60 seconds and validates immediately when the tab becomes visible. The interval is defined in `frontend/src/context/AuthContext.jsx` as:

```js
const SESSION_CHECK_INTERVAL_MS = 60_000;
```

## Load Testing

The `load-tests` directory contains k6 scenarios for health checks, mobile nearby-risk traffic, dashboard traffic, notification polling, and a mixed pilot workload.

Start with the public local health baseline:

```powershell
k6 run load-tests/health-check.js
```

Protected scenarios require a valid non-production test token:

```powershell
$env:ACCESS_TOKEN="replace-with-a-test-token"
$env:BARANGAY_NO="1"
k6 run load-tests/mobile-risk.js
k6 run load-tests/dashboard.js
k6 run load-tests/mixed-pilot.js
```

The default target is `http://localhost:5000`. Remote execution is blocked unless it is explicitly authorized:

```powershell
$env:BASE_URL="https://your-authorized-test-service.example"
$env:ALLOW_REMOTE_LOAD_TEST="true"
k6 run load-tests/mixed-pilot.js
```

Do not load-test the production service without scheduling the test, confirming the expected traffic, and monitoring Render and MongoDB metrics. Default thresholds require an error rate below 1% and a 95th-percentile response time below two seconds.

## Partially Implemented Features

### CSV / Legacy Dataset Path

There is legacy CSV parsing and generic dataset validation code in `backend/controllers/datasetController.js`, but the current upload flow rejects CSV files for official cases before the legacy path can be used. The schema still includes `csv_generic`, and old validation helpers remain.

Missing or unclear:

- Decide whether CSV support is intentionally removed or should be restored.
- Remove dead legacy code if XLSX-only is final.
- If CSV is restored, reconcile it with the required monthly fields and `OfficialCase` schema.

### Prediction Environment

The backend has Python Prophet scripts and Node wrappers, but predictions depend on a working Python/Prophet environment.

Missing or unclear:

- No automated setup script is documented for Python dependencies beyond `backend/services/prophet/requirements.txt`.
- Runtime behavior depends on environment variables such as `PYTHON_BIN` or system Python availability.
- No visible health check confirms Prophet readiness before upload or manual refresh.

### Mobile API Configuration

`mobile/lib/config/api_config.dart` uses hardcoded LAN/hotspot host values for local development.

Missing or unclear:

- No environment/flavor-based configuration for dev, staging, and production.
- Physical-device use requires manual IP changes.

### Mobile Analytics Filters

`backend/controllers/mobileController.js` builds a `match` object from `year`, `month`, and `caseClassification`, but some summary aggregations ignore that filter.

Missing or unclear:

- `totalCases`, `topDistrict`, and `topDisease` currently aggregate all official cases instead of the selected filter scope.
- Confirm whether the mobile analytics summary should reflect filters or always show global totals.

### Frontend Mock/Fallback Data

Mock report and official-case data files remain in `frontend/src/data`, and `AnalyticsPage.jsx` still contains commented mock fallback references.

Missing or unclear:

- Decide whether mock data should stay as developer fixtures or be removed before production.
- Ensure UI error states do not imply sample data is being shown when live data is required.

### Testing and QA

There are lint/build scripts for the frontend and generated Flutter test scaffolding, but no clear backend test suite and no end-to-end test coverage.

Missing or unclear:

- Backend unit/integration tests for uploads, auth, reports, analytics, heatmap, predictions, and mobile endpoints. The new k6 scenarios provide load coverage but do not replace correctness tests.
- Frontend route/component regression tests.
- Flutter widget/service tests beyond default platform scaffolding.
- Seed data or reproducible fixtures for local QA.

## Known Gaps, TODOs, and Broken or Risky Pieces

- `README.md` contains mojibake characters around dashes, likely from encoding conversion.
- The web `AuthContext` calls `axios.get("/api/auth/refresh")`, relying on a dev proxy or same-origin deployment, while many other frontend files use `VITE_API_BASE_URL` or `http://localhost:5000`. This should be standardized.
- `frontend/src/pages/LoginPage.jsx` displays sample admin/user credentials in the UI.
- `mobile/lib/config/api_config.dart` contains a concrete local IP address (`192.168.1.8`), which is environment-specific.
- `MAX_REPORTS_PER_24H` in `backend/controllers/reportController.js` is set to `Infinity`, so the DB-backed daily report rate limit is effectively disabled.
- Several development logs remain in backend/frontend code, including auth refresh and report-route logging.
- CSV upload messaging says CSV is unsupported, but legacy CSV code remains below that branch.
- Prediction failures are stored as failed `PredictionRun` records, but upload succeeds even if prediction fails. That behavior may be intended, but the UI should make prediction failures visible enough.
- There are no root-level scripts for starting the full backend/frontend/mobile stack together.
- Root `package.json` is an empty object, so monorepo orchestration is not currently implemented.
- Raw spreadsheet files are ignored in `.gitignore`, but existing workbook files are present in the workspace.
- Uploaded files are stored in a local `uploads` folder. There is no retention, cleanup, or object-storage strategy documented.
- Backend routes depend on environment secrets (`ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, SMTP values, Mongo URI), but production deployment guidance is minimal.

## File Inventory

### Root

- `.gitignore`: Ignore rules for local data files, uploads, logs, dependencies, build output, environment files, editor folders, Vite cache, and this generated `DOCU.md`.
- `README.md`: Setup and architecture overview for backend, frontend, and mobile app.
- `package.json`: Empty root package manifest.
- `package-lock.json`: Root npm lockfile.
- `rawHealthOffice.xlsx`: Local raw health-office workbook, ignored by git rules.
- `cleanedOfficialCases.xlsx`: Local cleaned official cases workbook, ignored by git rules.

### Backend Configuration and Entry

- `backend/.env.example`: Example backend environment configuration.
- `backend/package.json`: Backend dependencies and `npm run dev` script.
- `backend/package-lock.json`: Backend npm lockfile.
- `backend/server.js`: Express server bootstrap, middleware, rate limits, route registration, DB connection, and prediction cron registration.
- `backend/config/db.js`: MongoDB connection helper with bounded pool and server-selection settings.

### Backend Routes

- `backend/routes/activity.js`: Recent activity route.
- `backend/routes/analytics.js`: Dataset analytics summary route.
- `backend/routes/auth.js`: Web and citizen auth routes, access request routes, and password reset routes.
- `backend/routes/cases.js`: Dataset official-case listing route.
- `backend/routes/datasets.js`: Dataset upload, list, template download, and file download routes.
- `backend/routes/health.js`: API health route.
- `backend/routes/heatmap.js`: District/barangay heatmap route.
- `backend/routes/mobile.js`: Mobile dashboard, risk, nearby risk, and official analytics routes.
- `backend/routes/notifications.js`: Notification list and read/unread routes.
- `backend/routes/predictions.js`: Prediction read and admin refresh routes.
- `backend/routes/reports.js`: Citizen report create/list/history routes.
- `backend/routes/users.js`: User management and citizen profile routes.

### Backend Controllers

- `backend/controllers/activityController.js`: Returns recent activity log entries.
- `backend/controllers/analyticsController.js`: Builds analytics summary from official case rows.
- `backend/controllers/authController.js`: Web auth, access request OTP, access request submission, refresh, logout, and web password reset.
- `backend/controllers/caseController.js`: Lists official case rows by dataset.
- `backend/controllers/citizenAuthController.js`: Citizen register/login/check-phone/reset-password/mobile-refresh.
- `backend/controllers/mobileOtpController.js`: Mobile OTP send and verification endpoints.
- `backend/controllers/mobileUserController.js`: Mobile profile update with ownership checks.
- `backend/controllers/datasetController.js`: Dataset upload/list/download/template logic and legacy dataset parsing helpers.
- `backend/controllers/heatmapController.js`: Dataset heatmap aggregation and filtering.
- `backend/controllers/mobileController.js`: Mobile dashboard, heatmap risk, nearby risk, and analytics endpoints.
- `backend/controllers/notificationController.js`: Notification reads and unread state updates.
- `backend/controllers/predictionController.js`: Prediction retrieval and manual refresh.
- `backend/controllers/reportController.js`: Citizen report creation, report listing, duplicate suppression, and alert notifications.
- `backend/controllers/requestAccessController.js`: Older/simple access request controller; current auth route uses `authController.js`.
- `backend/controllers/userController.js`: Admin user management and current profile lookup.

### Backend Models

- `backend/models/ActivityLog.js`: Activity log schema.
- `backend/models/MobileOtp.js`: Hashed mobile OTP, verification-token, cooldown, attempt, and expiry state.
- `backend/models/MobileUser.js`: Mobile account schema stored in `mobile_users`.
- `backend/models/Dataset.js`: Uploaded dataset metadata schema.
- `backend/models/EmailOtp.js`: OTP storage schema for email verification flows.
- `backend/models/Notification.js`: Notification schema.
- `backend/models/OfficialCase.js`: Monthly official case schema with district, barangay, disease, classification, and cases.
- `backend/models/PredictionRun.js`: Stored monthly Prophet run containing operational forecasts, Seasonal Naïve benchmark metrics, rolling-origin errors, prediction intervals, and aggregate calibration metadata.
- `backend/models/Report.js`: Citizen suspected illness report schema.
- `backend/models/WebUser.js`: Web/admin account schema stored in `web_users`.

### Backend SMS and OTP Services

- `backend/services/mobileOtpService.js`: OTP generation, hashing, expiry, cooldown, attempt enforcement, verification, and one-time token consumption.
- `backend/services/semaphoreSmsService.js`: Semaphore regular-SMS request construction, Philippine-number normalization, provider configuration, timeout, and response validation.

### Backend Middleware, Constants, Jobs, and Utilities

- `backend/middleware/authMiddleware.js`: JWT verification and role guard.
- `backend/middleware/datasetUpload.js`: Multer upload configuration for datasets.
- `backend/middleware/performanceMonitoring.js`: Slow-request and periodic memory/forecast-queue instrumentation.
- `backend/constants/manilaDistrictCoords.js`: Manila district coordinates and district key normalization.
- `backend/jobs/predictionCron.js`: Scheduled prediction refresh registration.
- `backend/utils/citizenAuth.js`: Citizen token, phone normalization, and sanitization helpers.
- `backend/utils/datasetParsers.js`: Dataset parsing helpers.
- `backend/utils/logActivity.js`: Activity logging helper.
- `backend/utils/normalizeDistrict.js`: District normalization helper.
- `backend/utils/passwordValidation.js`: Shared password rules.
- `backend/utils/riskUtils.js`: Risk scoring and date-window helpers.
- `backend/utils/asyncTtlCache.js`: In-process TTL cache with request coalescing and cache statistics.

### Backend Services

- `backend/services/combinedCaseRowsService.js`: Combines or prepares case rows for analytics-style views.
- `backend/services/emailService.js`: SMTP email sending for OTP flows.
- `backend/services/notificationService.js`: Notification creation helpers.
- `backend/services/officialCaseImportService.js`: Official XLSX detection, validation, import, aggregation, and dataset persistence.
- `backend/services/officialCaseNormalizer.js`: Raw/template official case row normalization.
- `backend/services/statisticsCaseBuilders.js`: Analytics/statistics builders from official cases.
- `backend/services/validateDatasetFile.js`: Generic dataset file validation helper.
- `backend/services/predictions/refreshMonthlyDistrictPredictions.js`: Monthly district Prophet refresh and prediction-run persistence.
- `backend/services/predictions/refreshProphetPredictions.js`: Older yearly Prophet refresh path.
- `backend/services/predictions/forecastExecution.js`: Single-process forecast queue, deduplication, and execution metrics.
- `backend/services/prophet/forecast.py`: Python Prophet forecast script for yearly-style prediction.
- `backend/services/prophet/forecast_monthly.py`: Python Prophet forecast script for monthly district prediction.
- `backend/services/prophet/requirements.txt`: Python dependencies for Prophet scripts.
- `backend/services/prophet/runForecast.js`: Node wrapper for yearly Python forecast.
- `backend/services/prophet/runMonthlyForecast.js`: Node wrapper for monthly Python forecast.

### Frontend Entry, Routing, and Layout

- `frontend/package.json`: Frontend scripts and dependencies.
- `frontend/package-lock.json`: Frontend npm lockfile.
- `frontend/vite.config.js`: Vite configuration.
- `frontend/eslint.config.js`: ESLint configuration.
- `frontend/index.html`: Vite HTML entry.
- `frontend/README.md`: Default Vite/React readme.
- `frontend/src/main.jsx`: React entry point.
- `frontend/src/App.jsx`: App shell with router and toast provider.
- `frontend/src/App.css`: App-level styles.
- `frontend/src/index.css`: Global/Tailwind styles.
- `frontend/src/context/AuthContext.jsx`: Web auth state and refresh-on-load logic.
- `frontend/src/routes/AppRoutes.jsx`: Public/protected/admin route definitions.
- `frontend/src/routes/PrivateRoute.jsx`: Auth and role route guard.
- `frontend/src/routes/PublicRoute.jsx`: Redirects authenticated users away from public-only pages.
- `frontend/src/layouts/DashboardLayout.jsx`: Shared dashboard layout.

### Frontend Pages

- `frontend/src/pages/AnalyticsPage.jsx`: Dataset analytics dashboard.
- `frontend/src/pages/DashboardPage.jsx`: Main web dashboard.
- `frontend/src/pages/DataPage.jsx`: Dataset and report-log tab container.
- `frontend/src/pages/ForgotPasswordPage.jsx`: Web forgot-password OTP request flow.
- `frontend/src/pages/HeatmapPage.jsx`: Heatmap dashboard.
- `frontend/src/pages/LoginPage.jsx`: Web login screen.
- `frontend/src/pages/PredictionsPage.jsx`: Prophet-only operational forecast dashboard with Seasonal Naïve benchmark evaluation, coherent Whole-Manila totals, calibrated aggregate intervals, and comparison refresh.
- `frontend/src/pages/RequestAccessPage.jsx`: Web access-request and OTP flow.
- `frontend/src/pages/ResetPasswordPage.jsx`: Web password reset completion.
- `frontend/src/pages/UserManagementPage.jsx`: Admin user approval/rejection/deletion page.
- `frontend/src/pages/WelcomePage.jsx`: Public welcome screen.

### Frontend API, Hooks, Components, and Utilities

- `frontend/src/api/datasets.js`: Dataset API functions.
- `frontend/src/api/heatmap.js`: Heatmap API functions.
- `frontend/src/api/predictions.js`: Prediction API functions.
- `frontend/src/hooks/useAxiosPrivate.js`: Authenticated Axios helper hook.
- `frontend/src/hooks/useDatasets.js`: Dataset fetching hook.
- `frontend/src/hooks/useHeatmapPoints.js`: Heatmap fetching hook.
- `frontend/src/hooks/useLatestDatasetId.js`: Latest validated dataset helper hook.
- `frontend/src/hooks/useOfficialCases.js`: Official case loading hook.
- `frontend/src/hooks/useReports.js`: Report loading hook.
- `frontend/src/components/Navbar.jsx`: Top navigation and notifications access.
- `frontend/src/components/NotificationsDropdown.jsx`: Notification list and read/unread UI.
- `frontend/src/components/Sidebar.jsx`: Dashboard sidebar navigation.
- `frontend/src/components/Spinner.jsx`: Loading spinner.
- `frontend/src/components/analytics/AnalyticsGrid.jsx`: Analytics chart grid.
- `frontend/src/components/analytics/AnalyticsStats.jsx`: Analytics stat cards.
- `frontend/src/components/charts/*`: Recharts-based visualizations for districts, diseases, trends, risk, prediction errors, and actual-vs-predicted lines.
- `frontend/src/components/dashboard/RecentActivityCard.jsx`: Recent activity display.
- `frontend/src/components/data/OfficialDatasetsTab.jsx`: Dataset upload/list UI tab.
- `frontend/src/components/data/ReportLogsTab.jsx`: Citizen report logs UI tab.
- `frontend/src/components/datasets/UploadDropzone.jsx`: Dataset upload control.
- `frontend/src/components/datasets/RecentDatasetsList.jsx`: Recent dataset list.
- `frontend/src/components/heatmap/*`: Heatmap controls, map, legend, top districts, top disease, and stats row.
- `frontend/src/components/reports/ReportsLogList.jsx`: Report list renderer.
- `frontend/src/components/tables/DistrictStatisticsTable.jsx`: District statistics table.
- `frontend/src/constants/chartColors.js`: Chart and severity color constants.
- `frontend/src/constants/manilaDistrictCoords.js`: Manila district coordinate constants.
- `frontend/src/utils/*`: Frontend builders and helpers for analytics, cases, dashboard cards, date formatting, delay, heatmap, normalization, passwords, prediction chart rows, statistics, toasts, and aggregations.

### Frontend Data and Assets

- `frontend/src/data/districtStatistics.js`: Static district statistics data.
- `frontend/src/data/manila-barangays-with-legislative-districts.json`: Barangay GeoJSON/features with legislative districts.
- `frontend/src/data/manila-legislative-districts.json`: District geometry data.
- `frontend/src/data/mockOfficialCases.js`: Mock official case fixture data.
- `frontend/src/data/mockReports.js`: Mock report fixture data.
- `frontend/public/templates/official_cases_template.xlsx`: Downloadable official cases template.
- `frontend/public/vite.svg`: Default Vite asset.
- `frontend/src/assets/react.svg`: Default React asset.

### Mobile App Source

- `mobile/pubspec.yaml`: Flutter package configuration and dependencies.
- `mobile/pubspec.lock`: Flutter dependency lockfile.
- `mobile/analysis_options.yaml`: Flutter lint configuration.
- `mobile/README.md`: Default Flutter readme.
- `mobile/lib/main.dart`: Mobile app entry, service initialization, and route registration.
- `mobile/lib/config/api_config.dart`: Mobile API base URL selection.
- `mobile/lib/services/api_client.dart`: HTTP client with auth headers and token refresh.
- `mobile/lib/services/api_service.dart`: Mobile API methods for auth, reports, analytics, datasets, heatmaps, predictions, and nearby risk.
- `mobile/lib/services/alerts_repository.dart`: Alerts data access.
- `mobile/lib/services/heatmap_risk_service.dart`: Heatmap/risk service.
- `mobile/lib/services/location_service.dart`: Device location preload and permission/location helpers.
- `mobile/lib/services/manila_geo_service.dart`: Manila barangay geometry lookup.
- `mobile/lib/services/notification_service.dart`: Local notification setup.
- `mobile/lib/utils/philippine_mobile_number.dart`: Philippine phone formatting, conversion, input limiting, and validation.
- `mobile/lib/widgets/philippine_mobile_prefix.dart`: Always-visible `+63` phone-field prefix.
- `mobile/lib/services/risk_alert_service.dart`: Background/foreground high-risk alert monitoring.
- `mobile/lib/services/session.dart`: Persisted mobile session and token storage.
- `mobile/lib/screens/*`: Login, signup, forgot password, dashboard shell, home, analytics, alerts, map, report form, report history, profile, and personal information screens.
- `mobile/lib/widgets/*`: Reusable loading, dropdown, snackbar, alert, and home screen widgets.
- `mobile/lib/utils/dashboard_reference_period.dart`: Dashboard reference period helper.
- `mobile/lib/utils/heatmap_case_builders.dart`: Mobile heatmap case transformation helpers.
- `mobile/assets/foodsafe_logo.png`: Mobile app logo.
- `mobile/assets/manila_barangays.geojson`: Barangay GeoJSON asset.
- `mobile/assets/manila-barangays-with-legislative-districts.json`: Barangay/district data asset.

### Performance Test Scenarios

- `load-tests/helpers.js`: Localhost-first target guard, authentication helpers, and default thresholds.
- `load-tests/health-check.js`: Public health-endpoint baseline.
- `load-tests/mobile-risk.js`: Protected nearby-risk workload using the mobile monitoring interval.
- `load-tests/dashboard.js`: Protected mobile dashboard workload.
- `load-tests/mixed-pilot.js`: Concurrent risk, dashboard, and notification polling pilot simulation.

### Mobile Platform Scaffolding

- `mobile/android/*`: Android Gradle project, manifests, resources, launcher icons, and Kotlin activity.
- `mobile/ios/*`: iOS Runner project, plist, storyboards, icons, and generated Flutter integration files.
- `mobile/macos/*`: macOS Runner project, entitlements, configs, icons, and Swift app files.
- `mobile/linux/*`: Linux Flutter runner and CMake files.
- `mobile/windows/*`: Windows Flutter runner, resources, manifest, and CMake files.
- `mobile/web/*`: Flutter web index, manifest, favicon, and web icons.

## Surveillance Data Interpretation

- CESU surveillance records available to this project begin in 2022. Screens and exports must display the actual selected dataset coverage and must not imply complete CESU history before 2022.
- `reported`, `suspected`, and `confirmed` are separate analytical populations. The UI displays `confirmed` as **Validated / Confirmed** and must not combine statuses under an unlabeled “Total Cases” value.
- Official uploads record the institutional provider (`hospital`, `health_center`, `cesu`, or `doh`) separately from the ingestion method (`csv`, `excel`, or system integration).
- Weekly datasets use epidemiological year/week fields. Legacy monthly datasets remain explicitly monthly and must not be presented as weekly observations.
- Alert and epidemic thresholds require five eligible prior years. The system returns an insufficient-baseline result when five eligible years are unavailable; it does not manufacture missing history.
- Ordinary analytical charts use a restrained blue palette. Amber and red are reserved for genuine alert-threshold and epidemic-threshold signals.
