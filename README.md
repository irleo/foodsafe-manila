# FoodSafe Manila

**A descriptive and predictive web-and-mobile platform for foodborne illness monitoring in Manila.**

[**Live web application**](https://foodsafe-manila.online) · [**Mobile setup**](mobile/README.md) · [**Forecasting documentation**](docs/forecast-production.md)

> **Academic capstone project — not an official public-health service.** The platform is for research, demonstration, and controlled testing. Maps, analytics, and predictions are not medical advice or official health advisories.

## Project overview

FoodSafe Manila brings together official case datasets, citizen-submitted food-exposure reports, geographic visualization, and monthly forecasting in one system. It consists of a **React administration dashboard**, a **Flutter citizen-facing mobile application**, and a **shared Express API** with MongoDB persistence.

The system maintains an important data boundary: **citizen reports are not automatically treated as verified official cases**. Official case data powers the forecasting series; citizen reports remain a separate reporting and review workflow.

## What the system does

### Web administration dashboard

- View case summaries, historical trends, district and disease breakdowns, and interactive charts.
- Explore district- and barangay-level geographic heat maps.
- Upload and validate official datasets for analysis.
- Inspect monthly district forecasts, forecast history, and model backtesting results.
- Review citizen-submitted reports and their activity history.
- Manage users, access, and operational notifications.

### Citizen mobile application

- Register and sign in using a Philippine mobile number and SMS one-time password.
- Explore case insights, trends, and available predictions.
- Submit guided symptom and food-exposure reports and review report history.
- Find health facilities on a location-aware map, with filters and distance information when location is available.
- Review account settings, policies, and reporting/location disclosures.
- Receive app notifications.

## Screenshots

A selection of **9 screens** highlighting the core web dashboard, predictive capabilities, and mobile reporting experience. Additional screenshots remain available in [docs/screenshots](docs/screenshots/).

### Web application

**Landing page**

![FoodSafe Manila landing page](docs/screenshots/landing-page.png)

**Dashboard and analytics**

| Dashboard | Case analytics |
| --- | --- |
| ![Web dashboard](docs/screenshots/web-dashboard1.png) | ![Case analytics](docs/screenshots/analytics1.png) |

**Geographic monitoring and forecasting**

| Geographic heat map | Monthly predictions |
| --- | --- |
| ![Geographic heat map](docs/screenshots/heatmap.png) | ![Monthly predictions](docs/screenshots/predictions1.png) |

**Citizen report management**

![Citizen report management](docs/screenshots/citizen-report-management.png)

### Flutter mobile application

| Home | Insights | Guided reporting |
| --- | --- | --- |
| <img src="docs/screenshots/mobile-home1.jpg" alt="Mobile home" width="230"> | <img src="docs/screenshots/mobile-insights1.jpg" alt="Mobile insights" width="230"> | <img src="docs/screenshots/mobile-report2.jpg" alt="Guided citizen reporting" width="230"> |

## Technology stack

| Component | Technologies |
| --- | --- |
| Web | React 19, Vite, React Router, Tailwind CSS, Axios |
| Web charts and maps | Recharts, Leaflet, React Leaflet |
| Mobile | Flutter, Dart, `fl_chart`, `flutter_map`, geolocator, geocoding |
| Backend | Node.js, Express 5, MongoDB, Mongoose |
| Security and auth | JWT, bcryptjs, rate limiting, CORS, SMS OTP |
| File processing and storage | Multer, XLSX, private Cloudflare R2 |
| Forecasting | Python Prophet, historical backtesting, Seasonal Naïve benchmark |
| External services | Brevo, Semaphore SMS |
| Hosting and automation | Render, GitHub Actions |

## Architecture

```text
          React web dashboard         Flutter mobile app
                   \                        /
                    \                      /
                     v                    v
                         Express API
                      Auth · validation
                     Reporting · analytics
                       /       |        \
                      v        v         v
                  MongoDB   Cloudflare  Email / SMS
                               R2       integrations
                      |
                      v
            Official historical case data
                      |
                      v
            Prophet forecasting workflow
                      |
                      v
            Monthly district predictions
```

The API is the shared source of truth for both clients. Administrative operations, report workflows, analytics, and predictions are implemented in the backend rather than duplicated in the mobile and web applications.

## Predictive analytics

FoodSafe uses **Prophet** for monthly operational forecasts by Manila district. Its forecasting design includes:

- **District-level predictions:** forecasts are generated for the six Manila districts.
- **Bottom-up city totals:** whole-Manila point forecasts are aggregated from district forecasts.
- **Historical backtesting:** model behavior is evaluated against historical observations.
- **Benchmark comparison:** Seasonal Naïve is a historical benchmark, **not** an automatic production fallback.
- **Data provenance:** unverified citizen reports are not mixed into official confirmed-case forecasting series.

Forecast execution can be dispatched through GitHub Actions. Production activation depends on environment configuration and verification; see [forecast deployment](docs/forecast-production.md) and [forecast testing](docs/forecast-testing.md) for the operational details.

Forecasts are statistical estimates, not guaranteed outcomes or individual risk assessments.

## Repository structure

```text
foodsafe-manila/
├── backend/           # Express API, models, services, tests
├── frontend/          # React administrative web app
├── mobile/            # Flutter citizen application
├── docs/              # Forecast and technical documentation
├── load-tests/        # Performance testing resources
├── render.yaml        # Render service configuration
└── README.md
```

## Local development

**Prerequisites:** Node.js and npm, a MongoDB instance, and the Flutter SDK with Android tooling for mobile development.

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Configure the required environment variables in `backend/.env` using the example file. External integrations, storage, and forecast execution may require additional credentials or service configuration. Never commit real credentials.

### Web

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

### Mobile

```bash
cd mobile
flutter pub get
flutter run
```

The Android emulator's development API default is documented in [mobile/README.md](mobile/README.md), along with physical-device configuration and release-build requirements.

## Security, privacy, and reliability

The implementation includes JWT-based authentication and refresh flows, password hashing, OTP verification controls, role-aware API access, rate limiting, CORS allowlisting, sanitized production errors, redacted logs, request identifiers, and private object storage.

Mobile reporting uses policy acknowledgements and reporting/location disclosures. **Testing should use simulated symptoms and fictional exposure details**, consistent with the project's private-testing documentation.

The repository also includes automated checks for error disclosure, analytics data boundaries, authentication/report policies, and related defects.

## Documentation

- [Mobile application guide](mobile/README.md)
- [Forecast production workflow](docs/forecast-production.md)
- [Forecast testing](docs/forecast-testing.md)
- [Project documentation](DOCU.md)
- [Private testing privacy](backend/policies/private-testing-privacy.md)
- [Private testing reporting](backend/policies/private-testing-reporting.md)
- [Private testing terms](backend/policies/private-testing-terms.md)

## Project status

FoodSafe Manila is an **academic capstone under active development**. A live web deployment is available for demonstration, but that does not imply all mobile integrations, production forecast workflows, or public-health data feeds are independently verified or officially endorsed.
