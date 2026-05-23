## Architecture

- **Web** (`frontend/`) — React admin dashboard; all data via `http://localhost:5000/api`
- **Mobile** (`mobile/`) — Flutter citizen app; same backend API (configure host in `mobile/lib/config/api_config.dart`)
- **Backend** (`backend/`) — Express + MongoDB; single source of truth for auth, reports, analytics, predictions

The embedded API under `mobile/backend/` is deprecated. Do not run it.

## Setup

### Backend

1. `cd backend && npm install`
2. Copy `backend/.env.example` to `backend/.env` and set secrets + `MONGODB_URI`
3. `npm run dev` (port **5000**)

### Web

1. `cd frontend && npm install`
2. Optional: `VITE_API_BASE_URL=http://localhost:5000` in `frontend/.env`
3. `npm run dev`

### Mobile

1. `cd mobile && flutter pub get`
2. Set your machine LAN IP in `mobile/lib/config/api_config.dart` (`hostLanIp`) for physical devices
3. Start the monorepo backend on port 5000, then `flutter run`
