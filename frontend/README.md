# FoodSafe Manila Web Dashboard

The React administration dashboard supports official case monitoring, dataset uploads, citizen report review, forecasts, and account administration. It uses the shared [Express API](../docs/api.md); the citizen application is built separately in Flutter.

## Local development

Use Node.js 22.12 or newer within Node 22 and npm. Configure the backend using the [local setup guide](../docs/local-development.md), then run from the repository root in PowerShell:

```powershell
cd frontend
npm ci
Set-Content -LiteralPath .env -Value 'VITE_API_BASE_URL=http://localhost:5000'
npm run dev
```

The `Set-Content` command is for a new checkout; edit an existing `.env` rather than overwriting it. Open Vite's printed URL, normally `http://localhost:5173`. The backend must allow that exact origin through `ALLOWED_ORIGINS`. Sign in with an approved staff account; the repository does not provision a working demo account.

`VITE_API_BASE_URL` is the backend **origin without `/api` or a trailing slash**. Request paths add `/api` themselves. Axios uses the Vite `/api` development proxy when this variable is absent, while some fetch helpers default directly to `http://localhost:5000`; setting the variable explicitly keeps both paths consistent. Vite exposes `VITE_*` values to the browser. Provider keys, database URIs, and signing secrets belong only in the backend environment.

## Architecture

The application uses React 19, Vite 7, React Router 7, Tailwind CSS 4, Axios, Recharts, and Leaflet. It is implemented in JavaScript/JSX; the React type packages do not make it a TypeScript application.

| Area | Responsibility |
| --- | --- |
| `src/main.jsx` | Styles, Leaflet CSS, Axios base URL/cookies, React mounting |
| `src/App.jsx` | Providers and router composition |
| `src/routes/` | Lazy-loaded route tree, authentication and role guards |
| `src/layouts/DashboardLayout.jsx` | Dashboard navigation and content shell |
| `src/context/AuthContext.jsx` | In-memory access token, role, initial refresh, session heartbeat |
| `src/modules/` | Feature pages, hooks, components, data transformation helpers |
| `src/api/` | Shared dataset, prediction, and threshold requests |
| `src/hooks/` | Shared official-case and latest-dataset hooks |
| `src/components/` | Navigation, loading/error states, data-coverage notices |
| `src/utils/`, `src/constants/` | Formatting, safe errors, chart colors, surveillance methodology |

## Routing and access

`src/routes/AppRoutes.jsx` lazy-loads pages with `React.lazy` and a `Suspense` loading state.

| Routes | UI access |
| --- | --- |
| `/`, `/login`, `/request-access`, `/forgot-password`, `/reset-password` | Public landing/authentication flows; public auth pages redirect signed-in users |
| `/dashboard`, `/analytics`, `/heatmap` | Authenticated users |
| `/datasets`, `/predictions`, `/settings` | `admin`, `cesu` |
| `/reports` | `admin`, `cesu`, `surveillance_team` |
| `/user-management` | `admin` |

`/welcome` redirects to `/`; `/thresholds` redirects to `/dashboard`. Unknown paths return to `/`. Client guards control navigation; API middleware independently enforces endpoint permissions.

## Hooks, authentication, and API integration

`AuthContext` attempts cookie-based session refresh when the app opens. It keeps the access token in React state, checks the session every 60 seconds, and checks again when the tab becomes visible. `useAxiosPrivate` attaches the bearer token, retries an unauthorized request once after refresh, and clears authentication if refresh fails.

Shared hooks load the latest validated dataset and official cases. Feature hooks handle dataset operations, citizen report lists, heatmap points, and the latest prediction run. API wrappers use both Axios and fetch, so check their error and authentication behavior when adding a request.

Official CESU case history and citizen reports have separate workflows. Official analytical views must not silently substitute citizen submissions or sample records for official cases. Components expose loading, empty, error, and coverage states; transformation helpers prepare API data for presentation.

## Charts and maps

Recharts renders district comparisons, disease distributions, historical trends, actual-versus-predicted series, and forecast intervals. Shared colors live in `src/constants/chartColors.js`; chart builders remain inside each feature module.

Leaflet and React Leaflet render the Manila heatmap with `leaflet.heat`, bundled barangay geography, district coordinates, and OpenStreetMap tiles. The heatmap module combines API responses with local geography and exposes filters and legends. External map tiles require internet access.

## Commands and checks

Run from `frontend/`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite |
| `npm run lint` | ESLint |
| `npm run build` | Build production assets into `dist/` |
| `npm run preview` | Preview an existing production build |
| `npm run test:errors` | Error disclosure regressions |
| `npm run test:analytics-boundary` | Official/citizen boundary regressions |
| `npm run test:auth-refresh` | Session refresh regressions |
| `node --test "tests/*.test.js"` | All current Node frontend regressions, including threshold caching |

There is no generic `npm test` script. These Node tests exercise helpers and boundaries; they do not establish complete browser or visual coverage. See [test documentation](../docs/testing.md).

## Deployment

The [Render Blueprint](../render.yaml) builds with `npm ci && npm run build`, publishes `dist`, and rewrites client routes to `/index.html`. Set `VITE_API_BASE_URL` before building; changing it requires another build. Backend CORS must allow the deployed frontend origins. If the API hostname changes, also review the Blueprint's Content Security Policy `connect-src` value.

The frontend job in [FoodSafe CI](../.github/workflows/ci.yml) runs `npm ci`, ESLint, all Node frontend regressions, and the production build. See the [system architecture](../docs/architecture.md) and [deployment guide](../docs/ci-cd-deployment-guide.md) for execution boundaries, first-run verification, and required-check setup.
