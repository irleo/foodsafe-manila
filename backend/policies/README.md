# Mobile Testing Policies

Private testing policies are available with status `testing`, version
`2026-10-05.testing.2`. Registration does not require legal publication. Testers
explicitly accept Terms and acknowledge Privacy using unchecked controls; these
are not blanket consent to location or reports. Signing in stays available.

Edit `private-testing-terms.md`, `private-testing-privacy.md`, and the reporting
and location notices in `mobilePolicies.js`. These describe accounts, Semaphore
OTP, Brevo email, symptoms/exposure reports, precise coordinates, authorized staff
review, analytics, and the absence of automatic account/report deletion. They do
not invent a government affiliation, legal approval, or deletion deadline.

After policy changes, update the immutable version and regenerate the mobile copy:

```sh
node backend/policies/exportMobilePolicies.js
```

Redeploy/restart the backend and rebuild the mobile app together. The mobile
asset makes policy text readable without a working API; backend version checks
still determine which acceptance is valid. Policy controls are links below
registration, with additional links at login, account, and Privacy and Terms.

Material changes update `requiredVersion`; existing accounts must acknowledge
before profile changes or reporting, not before sign-in or public browsing.
Non-material changes may retain the previously required version. Never backfill
acceptance for existing users or silently assume consent.

`MobileUser.policyAcceptance` stores versions and server timestamps.
`policyAcceptances` stores user ID, type, version, action, and timestamp.
Registration and receipts commit together in a MongoDB transaction, requiring a
replica set or Atlas. No database migrations or data changes have been run.
Reports store disclosure versions/time and separate purpose-specific consent.

These are general testing notices, not a certification of Philippine legal
compliance. Use simulated health reports. Broader deployment or genuine health
data needs an operator-specific notice and an appropriate lawful basis.

Sources: [NPC right to be informed](https://privacy.gov.ph/the-right-to-be-informed/)
and [NPC consent guidelines](https://privacy.gov.ph/wp-content/uploads/2023/11/NPC-Circular-No.-2023-04_Guidelines-on-Consent_07Nov2023.pdf).

Focused mocked backend tests:

```sh
cd backend
node --test tests/mobilePolicies.test.js
```
