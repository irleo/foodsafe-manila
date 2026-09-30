# FoodSafe Manila

FoodSafe Manila is a web and mobile foodborne-disease monitoring platform built as a capstone project for Manila. It combines official case records, citizen-submitted reports, analytics, geographic risk visualization, notifications, and monthly forecasting through a shared backend API.

**Live web application:** https://foodsafe-manila.online

## Overview

The project has three main parts:

- **Web dashboard** — React administration interface for authorized users.
- **Mobile app** — Flutter application for citizens to submit reports, view alerts, inspect nearby risk, and review analytics.
- **Backend API** — Express and MongoDB service used by both clients for authentication, reports, datasets, analytics, heat maps, notifications, and predictions.

The backend is the source of truth for web and mobile data.

## Key Features

- Official dataset upload and validation
- Analytics and case summaries
- District and barangay heat maps
- Citizen report logs
- User administration
- Notifications and activity logging
- Phone-based mobile registration with SMS OTP
- Location-aware nearby-risk information
- Monthly Prophet forecasting and historical backtesting
- Private Cloudflare R2 storage

## Technology Stack

### Web
React 19, Vite, Tailwind CSS, Axios, React Router, Leaflet / React Leaflet, Recharts

### Mobile
Flutter, Dart, flutter_map, geolocator, geocoding, local notifications, shared preferences

### Backend
Node.js, Express 5, MongoDB / Mongoose, JWT, bcrypt, Multer, XLSX, node-cron, Cloudflare R2

### External Services and Deployment
Render, Cloudflare R2, Brevo, Semaphore SMS, GitHub Actions

## Forecasting

FoodSafe uses **Prophet** for operational monthly district forecasts. Seasonal Naïve is retained as a historical benchmark rather than a fallback model. Whole-Manila point forecasts are calculated bottom-up from the six district forecasts. Citizen reports are surfaced separately and are not treated as official confirmed cases in the forecasting series.

## Architecture

```text
React Web Dashboard ─┐
                     ├──> Express API ───> MongoDB
Flutter Mobile App ──┘         │
                               ├──> Cloudflare R2
                               ├──> Brevo
                               ├──> Semaphore
                               └──> Prophet forecasting
```

## Project Structure

```text
foodsafe-manila/
├── backend/
├── frontend/
├── mobile/
├── docs/
├── load-tests/
├── render.yaml
└── README.md
```

## Local Setup

### Backend
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### Web
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

## Security and Reliability

The project includes rate limiting, CORS allowlisting, password hashing, access/refresh-token workflows, OTP verification controls, private object storage, sanitized production error messages, redacted backend logging, request identifiers, and prediction process safeguards.

## Project Status

FoodSafe Manila is an academic capstone project and remains under active development. It should not be treated as an official public-health service.
