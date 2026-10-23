# Backend API Guide

The shared Express API is mounted by [backend/server.js](../backend/server.js). Local base URL: `http://localhost:5000/api`. Examples below use PowerShell and placeholders, not working credentials or patient records. Routes and controllers remain the authoritative request/response definitions.

## Authentication and common behavior

- Staff login uses `POST /auth/login` with `email` and `password`, requires an approved account, returns `accessToken`, and sets an HTTP-only session refresh cookie. `GET /auth/refresh` uses that cookie; `POST /auth/logout` clears the web session.
- Citizen login uses the same login route with `phone` and `password`. It returns access/refresh tokens. `POST /auth/mobile/refresh` accepts the citizen refresh token in the JSON `refreshToken` field.
- Protected endpoints use `Authorization: Bearer <access-token>`. Verification checks the persisted token version. Role checks and some controller ownership/policy checks apply in addition to token validity.
- Roles are `admin`, `cesu`, `surveillance_team`, and `citizen`. A route listed as token-protected below does not imply every account may read every resource; controllers can further restrict scope and identity fields.
- JSON requests use `Content-Type: application/json`. Workbook requests use multipart form data with field `file`.
- The API applies general and endpoint-specific rate limits. Standardized errors include a safe message, code, and request identifier where supplied by the error middleware. Use HTTP status and error code rather than matching human-readable messages.
- Common paginated lists accept `page` and `limit`. Shared pagination defaults to 20 and caps at 50; endpoint overrides include official case retrieval's maximum of 5,000 and notifications' default of 10.

All paths below are relative to `/api`.

## Endpoint groups

| Group | Methods and paths | Access / purpose |
| --- | --- | --- |
| Health | `GET /health` | Public process response, not a database/forecast readiness check |
| Staff sessions | `POST /auth/login`, `POST /auth/logout`, `GET /auth/refresh` | Credentials or session cookie as described above |
| Staff access | `POST /auth/request-access/send-otp`, `POST /auth/request-access` | Public request flow with email OTP; approval is separate |
| Staff password recovery | `POST /auth/forgot-password`, `POST /auth/reset-password/verify-otp`, `POST /auth/reset-password/complete` | Public, proof-based recovery |
| Citizen registration/login recovery | `POST /auth/register`, `POST /auth/mobile/otp/send`, `POST /auth/mobile/otp/verify`, `POST /auth/reset-password`, `POST /auth/mobile/refresh` | Flow-specific SMS proofs, policy choices, or refresh token; public entry points do not bypass verification |
| Email verification/recovery | `POST /auth/email/otp/send`, `POST /auth/email/otp/verify` | Purpose-specific email proof workflow; see mobile client/controller contracts |
| Account lookup | `GET /auth/user/exists`, `GET /auth/user/email-exists` | Public preflight endpoints with the implemented privacy protections |
| Policies | `GET /auth/mobile/policies` | Public current policy documents/versions |
| Policy acceptance | `GET /auth/mobile/policies/status`, `POST /auth/mobile/policies/accept`, `POST /auth/mobile/policies/reporting/accept` | Citizen token; reporting acceptance also requires current general policies |
| Phone change | `POST /auth/mobile/phone-change/otp/send` | Citizen token and current policies |
| Dataset list | `GET /datasets` | Internal `admin`, `cesu`, `surveillance_team`; paginated validated dataset selection |
| Dataset validation/import | `POST /datasets/validate`, `POST /datasets/upload` | Internal `admin`, `cesu`; preview then confirmed upload |
| Private workbook downloads | `GET /datasets/template/official-cases`, `GET /datasets/:id/download` | Internal `admin`, `cesu`; streamed template/original from private storage |
| Official analytical cases | `GET /cases/:datasetId` | Token; authoritative case series, pagination, supported filters |
| Analytics | `GET /analytics/summary/:datasetId` | Token; official analytics |
| Heatmap | `GET /heatmap/districts` | Token; geographic analytical view |
| Predictions | `GET /predictions` | Token; eligible saved forecast retrieval |
| Refresh predictions | `POST /predictions/refresh` | `admin`, `cesu`; creates/reuses forecast work according to execution mode |
| Mobile protected views | `GET /dashboard`, `GET /risk/heatmap`, `GET /risk/nearby`, `GET /official-cases/analytics` | Token; shared mobile views, with controller validation |
| Public insights | `GET /insights/analytics`, `GET /insights/predictions` | Public, separately rate-limited aggregate views |
| Citizen report submission | `POST /reports` | Citizen token and current policies; reporting consent/disclosures and submission validation also apply |
| Report history | `GET /reports/user/:userId`, `GET /reports/user/:userId/last` | Token; controller ownership/access checks |
| Report management | `GET /reports`, `GET /reports/:id/audit` | `admin`, `cesu`, `surveillance_team`; report/identity policies apply |
| Report decisions | `POST /reports/:id/investigation`, `POST /reports/:id/mark-suspected`, `POST /reports/:id/rule-out`, `POST /reports/:id/validation` | Report-management roles and workflow validation |
| Staff administration | `GET /users`, `GET /users/stats`, `PATCH /users/:id/status`, `PATCH /users/:id/access`, `DELETE /users/:id` | `admin`, with controller restrictions |
| Account profile | `GET /users/me` | Token |
| Citizen profile change | `PUT /users/:id` | Citizen token, current policies, ownership and profile validation |
| Activity | `GET /activity` | Internal `admin`, `cesu`, `surveillance_team` |
| Notifications | `GET /notifications`, `PATCH /notifications/read-all`, `PATCH /notifications/:id/read`, `PATCH /notifications/:id/unread` | Internal staff roles; visibility filtering and per-user read receipts |
| Current thresholds | `GET /thresholds/current` | `admin`, `cesu`, `surveillance_team` |
| Threshold settings | `GET /thresholds/settings`, `PUT /thresholds/settings` | `admin`, `cesu` |

The mobile routes are mounted directly under `/api`: for example `/api/dashboard`, not `/api/mobile/dashboard`.

## Example requests

Run against an isolated local database. The login example updates account login metadata and obtains a real session; use an approved development account. Do not paste tokens or cookie jars into logs or issue reports.

```powershell
$apiBase = 'http://localhost:5000/api'
Invoke-RestMethod -Uri "$apiBase/health"

$credentials = @{
    email = 'your-approved-development-account@example.com'
    password = '<your-local-password>'
} | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$apiBase/auth/login" `
    -ContentType 'application/json' -Body $credentials -SessionVariable staffSession
$headers = @{ Authorization = "Bearer $($login.accessToken)" }

Invoke-RestMethod -Uri "$apiBase/users/me" -Headers $headers
Invoke-RestMethod -Uri "$apiBase/datasets?page=1&limit=20&status=validated" -Headers $headers
Invoke-RestMethod -Uri "$apiBase/auth/refresh" -WebSession $staffSession
```

Use an actual validated dataset `_id` from the development list for analytical requests:

```powershell
$datasetId = '<validated-development-dataset-id>'
Invoke-RestMethod -Uri "$apiBase/cases/${datasetId}?page=1&limit=20&caseClassification=confirmed" -Headers $headers
Invoke-RestMethod -Uri "$apiBase/analytics/summary/$datasetId" -Headers $headers
Invoke-RestMethod -Uri "$apiBase/predictions?datasetId=$datasetId" -Headers $headers
```

Public insights do not require the staff session:

```powershell
Invoke-RestMethod -Uri "$apiBase/insights/analytics?period=total_cumulative"
```

Public analytics accepts `period=total_cumulative|last_7_days|last_28_days` and optional `district`/`disease` filters constrained by the controller. Do not assume arbitrary field names are supported.

## Workbook preview and import contract

Both multipart endpoints require `file`, a nonempty `name`, `coverageStart` and `coverageEnd` as `YYYY-MM-DD`, and `coverageVerified=true` for complete coverage across all six districts. Accepted workbook extensions are `.xlsx` and `.xls`; CSV is rejected by the active path.

`POST /datasets/validate` returns preview diagnostics and a `validationToken` when upload is allowed. `POST /datasets/upload` must submit the same workbook/metadata with that token. Include `confirmSkipMissing=true` when the preview requires explicit skipped-row confirmation. Changed content or metadata requires another preview. Upload persists data and may trigger a forecast; it is not a read-only check.

For PowerShell 7, a preview using a fictional official-format fixture can be sent with the existing `$headers`:

```powershell
$previewForm = @{
    file = Get-Item -LiteralPath 'C:\path\to\synthetic-official-cases.xlsx'
    name = 'Synthetic development coverage'
    coverageStart = '2024-01-01'
    coverageEnd = '2024-01-31'
    coverageVerified = 'true'
}
$preview = Invoke-RestMethod -Method Post -Uri "$apiBase/datasets/validate" `
    -Headers $headers -Form $previewForm
```

The fixture dates and rows must actually satisfy the declared coverage. Validation tokens are not reusable across users, modified payloads, or expiry. Use the dashboard's reviewed preview flow for import rather than bypassing diagnostics.

## Errors and source references

Typical status classes are `400` for invalid input, `401` for absent/expired/revoked sessions, `403` for access or policy restrictions, `409` for conflicts, `429` for rate limits, and `5xx` for server/dependency failures. Some login/flow errors use their own documented controller statuses; clients should read the returned safe payload. Workbook diagnostics can also report `canUpload=false` in an HTTP `200` preview.

See [routes](../backend/routes/), [controllers](../backend/controllers/), [authentication middleware](../backend/middleware/authMiddleware.js), and [error middleware](../backend/middleware/errorHandler.js). For startup/configuration use [local development](local-development.md); for remote forecasting use [forecast deployment](forecast-production.md).
