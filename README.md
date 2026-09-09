## Architecture

- **Web** (`frontend/`) — React admin dashboard; all data via `http://localhost:5000/api`
- **Mobile** (`mobile/`) — Flutter citizen app; same backend API (configure host in `mobile/lib/config/api_config.dart`)
- **Backend** (`backend/`) — Express + MongoDB; single source of truth for auth, reports, analytics, predictions
- **Object storage** — private Cloudflare R2 bucket for the upload template and immutable original workbooks

The embedded API under `mobile/backend/` is deprecated. Do not run it.

Production API errors use safe, stable error codes and an `ERR-XXXXXXXX`
reference. Share that reference when troubleshooting; technical stack traces and
service details are written only to redacted backend logs.

## Setup

### Backend

1. `cd backend && npm install`
2. Copy `backend/.env.example` to `backend/.env` and set secrets, `MONGO_URI`, and the four `R2_*` variables
3. `npm run dev` (port **5000**)

### Cloudflare R2

Use one private bucket (default: `foodsafe-datasets`) with these case-sensitive object prefixes:

- `templates/FoodSafe_Template.xlsx` — administrator-maintained template.
- `datasets/<dataset-id>/original.<ext>` — originals written by the backend after validation.

Do not enable public access. Template and dataset downloads are authenticated and streamed through the backend API. Scope the R2 token to this bucket with object read/write access; deletion is used only to clean up an orphan if database persistence fails.

### Web

1. `cd frontend && npm install`
2. Optional: `VITE_API_BASE_URL=http://localhost:5000` in `frontend/.env`
3. `npm run dev`

### Mobile

1. `cd mobile && flutter pub get`
2. Set your machine LAN IP in `mobile/lib/config/api_config.dart` (`hostLanIp`) for physical devices
3. Start the monorepo backend on port 5000, then `flutter run`
