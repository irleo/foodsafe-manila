# Citizen Recovery Email Rollout

An email is trimmed/lowercased before validation, lookup, and storage. Non-empty
emails are unique across citizen accounts, including unverified addresses. Empty
emails are permitted on multiple accounts. A saved email is not recovery-capable
until an authenticated email OTP verification sets `emailVerified` and
`emailVerifiedAt`. Email changes clear that evidence and increment `emailVersion`.
OTP proofs are account/version-bound, single-use, and separate from SMS proofs.

## Existing Records

Before enabling the unique index, pause registration/profile/email-verification
writes and take a recoverable backup. Inspect the dry-run counts and establish a
tester notification/support plan. Do not automatically merge accounts, pick the
oldest account, or mark historical emails verified. For every normalized duplicate
group, unlink the email from ALL affected accounts. Accounts, phone sign-in, and
reports remain intact. Each affected tester must add a uniquely assigned address
and verify it again. Invalid historical addresses are also unlinked. Unique legacy
addresses are normalized and remain unverified unless there is existing valid
verification evidence for the unchanged normalized value.

The script is read-only by default; it reports counts, not raw emails or OTPs.
Full-collection maintenance uses bounded cursors/bulk batches, not an in-memory
account list. It never drops indexes or deletes accounts. Do not run while the app
is accepting writes, and do not run any write command without approval.

With `MONGO_URI` or `MONGODB_URI` already supplied to the process:

```sh
node backend/maintenance/recoveryEmailMigration.js
# Only after backup, review, approval, and pausing writes:
node backend/maintenance/recoveryEmailMigration.js --apply --confirm-database YOUR_DATABASE
node backend/maintenance/recoveryEmailMigration.js --create-index --confirm-database YOUR_DATABASE
```

The final command refuses index creation if unresolved normalization/duplicates
remain. Schema auto-index creation is disabled for MobileUser so deployment cannot
attempt the unique index before cleanup. Existing phone uniqueness must remain;
for a fresh database, provision its declared phone index explicitly too.

Until `mobileUsersRecoveryEmailUnique` exists with the expected unique partial
definition, assigning/verifying non-empty recovery emails fails safely. Registration
without an email and phone sign-in/recovery continue to work. Anonymous email
recovery always gives the same accepted response for missing, unverified, cooldown,
and eligible addresses. The legacy email-exists endpoint returns a constant response;
updated mobile clients do not call it. Anonymous OTP cancellation is deliberately
a no-op so it cannot invalidate another person's challenge.

## Test Flow

Save a recovery email in Account Information, tap Verify recovery email, request
a code, and enter it. The shared Brevo OTP template is currently reused; keep its
wording generic to email verification rather than asserting a password was reset.
No plaintext development OTP fallback is returned or logged by these endpoints.

Focused mocked tests: `node --test tests/recoveryEmail.test.js tests/mobilePolicies.test.js`
from backend. Database migration/index creation has not been executed automatically.
