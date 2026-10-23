# Security Policy

FoodSafe Manila is an academic capstone and private-testing platform. It is not an official public-health service. Security reports are welcome for the React dashboard, shared Express API, Flutter app, forecasting workers, and repository/deployment configuration.

## Supported code

Security maintenance focuses on the current `production` branch and fixes under review for that branch. Historical branches, older tags, and the deprecated `mobile/backend/` implementation do not have a separate maintenance commitment. Responses and fixes are handled by the capstone maintainers on a best-effort basis; no response-time guarantee is offered.

## Reporting a vulnerability

1. Open this repository's [Security Advisories page](https://github.com/irleo/foodsafe-manila/security/advisories).
2. If **Report a vulnerability** is available, use it to send a private report to the maintainers. Include the affected commit/component, prerequisites, a minimal reproduction with synthetic data, expected versus actual behavior, and likely impact.
3. If private reporting is unavailable and you already have an agreed private channel with the testing organizer, use that channel. Otherwise open a public [security-contact request](https://github.com/irleo/foodsafe-manila/issues/new?title=Security%20contact%20request) asking only for a private reporting channel. Include no vulnerability details, credentials, account identifiers, health records, or location data in that public request.

Do not disclose exploit details in public issues, pull requests, screenshots, CI logs, or discussions while a private report is being coordinated. Do not attach raw production exports or working secrets. A redacted request/response and a synthetic reproduction are normally enough to begin review. Private-reporting availability is a GitHub setting; this file does not enable it. See [GitHub's private-reporting instructions](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/report-privately).

## Testing and simulated-data boundaries

- Reproduce issues in your own local environment or an explicitly authorized testing environment using accounts you control. Coordinate any production verification with the maintainer first.
- Use simulated symptoms, fictional exposure details, and synthetic or properly sanitized official-format datasets. Real patient records and another person's personal details are outside the private trial's test-data boundary.
- Test accounts can still involve real phone numbers, recovery email addresses, device locations, and provider messages. Treat those identifiers as sensitive even when symptoms and exposure details are fictional.
- Citizen reports remain separate from authoritative official case datasets and forecast inputs. A report's workflow classification does not authorize mixing it into official surveillance totals or model training.
- Do not perform production load testing, message flooding, account enumeration, database writes/resets, or destructive verification without separate authorization. Use the existing mock/synthetic regression suites where they cover the issue.

The [private-testing privacy notice](backend/policies/private-testing-privacy.md) and [reporting disclosure](backend/policies/private-testing-reporting.md) describe the current trial. This policy does not expand consent or authorize genuine health-data collection.

## Sensitive-data precautions

- Keep MongoDB URIs, JWT/OTP signing material, GitHub worker tokens, Brevo/Semaphore keys, and R2 credentials in private backend or deployment settings. Never place them in browser-exposed `VITE_*` settings or mobile assets.
- Keep private `.env` files, raw workbooks, exports, logs, uploads, and forecast artifacts out of commits. `.gitignore` does not remove a file that was already committed or erase earlier history.
- Keep R2 private; use authenticated API downloads and narrowly scoped provider/database credentials. Match worker branches/environments to their intended databases.
- Review screenshots, test fixtures, error output, and CI artifacts for names, contact details, precise locations, patient records, and tokens before sharing. Fictional records linked to a real account can still identify a tester.
- Preserve the separate frontend/backend lockfiles. Changes to authentication, policy enforcement, reporting boundaries, and forecast publication should retain the relevant regression coverage and pass PR checks.

## If credentials or private records are exposed

Privately notify the maintainer with redacted location information such as the affected path/commit. Revoke or rotate affected credentials first; deleting a current file does not invalidate an exposed token. Stop distributing affected records and agree on containment for artifacts, logs, and shared copies.

History rewriting, force pushes, production repair, and data restoration require a separately reviewed and explicitly authorized plan with collaborators. No history rewrite or credential validation against live providers is part of the routine repository audit. See [GitHub's sensitive-data removal guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).
