# FoodSafe Manila Mobile

FoodSafe Manila is a Flutter mobile app for browsing foodborne illness information in Manila, exploring local health facilities, and submitting symptom and food-exposure reports. It connects to the shared FoodSafe Express API in `../backend/`; the React administration dashboard lives in `../frontend/`.

The current bundled policies describe a **private testing trial**. Test reports should use simulated symptoms and fictional exposure details. Maps, analytics, and forecasts are for evaluating the app and are not medical advice or an official health service.

## Features

- **Home and insights:** View case summaries, district and disease distributions, historical trends, and forecasts supplied by the backend.
- **Health facility map:** Browse Manila health centers and hospitals, filter facility types, and view facility details and distance when location is available. Location loads automatically once phone permission and location services are enabled; access is managed in phone settings, with no in-app location toggle.
- **Reporting:** Complete a guided report with symptoms, food/exposure details, and geographic information; review it before submission and view your report history.
- **Accounts:** Register and sign in with a Philippine mobile number, verify SMS codes, update account information, change passwords, and manage recovery email verification.
- **Privacy controls:** Read Terms of Use and the Privacy Policy before registration. Review separate reporting/location disclosures on first use; the backend saves the versions and acknowledgement/consent timestamp so later reports open the form directly unless policies change. Bundled notices remain readable when the API is unavailable.
- **Development tools:** Simulate a Manila district/barangay in debug builds to exercise geographic features without being physically in Manila.

## Technology

Built with Flutter and Dart, using Inter typography and FoodSafe's blue branding. Key packages include `flutter_map` for maps, `fl_chart` for charts, location/geocoding plugins for geographic features, `http` for API requests, `flutter_secure_storage` for credentials, and `shared_preferences` for local preferences.

Android is the primary mobile development target. Platform folders are also present for iOS, web, and desktop; their presence does not imply every feature has been validated on those platforms.

## Local development

Prerequisites:

- A Flutter SDK with Dart compatible with the `^3.10.0` constraint in `pubspec.yaml`.
- Android SDK tools and an Android emulator or connected device.
- The shared backend configured and running on port `5000`; see the repository's [setup instructions](../README.md#backend).

From the repository root:

```powershell
cd mobile
flutter pub get
flutter run
```

Debug builds default to `http://10.0.2.2:5000/api`, which reaches the host machine's backend from the Android emulator.

For a physical device or a different API host, supply the complete API base URL, including `/api`:

```powershell
flutter run --dart-define=API_BASE_URL=http://192.168.1.100:5000/api
```

Replace the example IP with your development machine's LAN address. The phone must be able to reach that host and port. API configuration is defined in `lib/config/api_config.dart`; editing source code is not required to override the URL.

Use the shared backend in `../backend/`. The legacy `mobile/backend/` API is deprecated.

## Release builds

Release builds require an explicit `API_BASE_URL`. For an Android APK:

```powershell
flutter build apk --release --dart-define=API_BASE_URL=https://your-api-host.example/api
```

Replace the example with your deployed API URL. The Android release configuration currently uses the debug signing key; configure production signing before distributing a production build.

## Project layout

| Path | Purpose |
| --- | --- |
| `lib/screens/auth/` | Sign in, registration, and password recovery/change |
| `lib/screens/account/` | Account information and recovery email verification |
| `lib/screens/dashboard/` | Home and insights content |
| `lib/screens/map/` | Health facility map |
| `lib/screens/reporting/` | Report form and report history |
| `lib/screens/legal/` | Policy readers and reporting disclosure |
| `lib/screens/debug/` | Development-only location simulation |
| `lib/layout/` | Authentication shell, dashboard navigation, and shared refreshable pages |
| `lib/services/` | API access, sessions, credential storage, policies, and location handling |
| `lib/config/` | API base URL configuration |
| `lib/models/` and `lib/data/` | Facility models and bundled facility data |
| `lib/widgets/` and `lib/utils/` | Shared UI elements, input handling, and formatting |
| `assets/` | Branding, geographic resources, and bundled policy notices |
| `test/` | Automated checks for mobile behavior |

## Static checks

```powershell
flutter analyze
```
