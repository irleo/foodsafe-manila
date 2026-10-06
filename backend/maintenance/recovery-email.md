# Citizen Recovery Email Rollout

The registered phone number identifies the account. The account's normalized
email is only a recovery destination and may be shared by multiple citizens.
Email format validation and current-password checks remain in profile editing.
Saving an email does not send an OTP.

## Recovery Protocol

1. Submit the registered phone number to `POST /api/auth/email/otp/send`.
2. The server reads that account's saved email and reserves an account-scoped
   challenge before delivery. The anonymous response contains an opaque `flowId`
   and the same message/timing for absent accounts, missing addresses, cooldown,
   and provider failures. It does not disclose the address.
3. Resend using the same phone and `flowId`. A wrong/expired flow cannot mutate
   another challenge. For a fresh flow after expiry, omit `flowId`; the existing
   account cooldown still applies.
4. Verify via `POST /api/auth/email/otp/verify` with `phone`, `flowId`, and `otp`.
5. Reset via `POST /api/auth/reset-password` with `phone`,
   `recoveryMethod: "email"`, `flowId`, `verificationToken`, and `newPassword`.

OTP and proof hashes bind the user, phone, destination, email version, session
version, and flow. Codes expire in five minutes; reset proofs expire in ten.
Five failed guesses, the 60-second resend cooldown, IP send/verify rate limits,
single-use proof consumption, and transactional session revocation remain.
Each account sharing an address has an independent challenge.

`emailVerified` and `emailVerifiedAt` mean the current saved address was used
successfully in an email recovery. They are historical evidence only, never
recovery eligibility or authority. Email edits clear this evidence and increment
`emailVersion`. Every recovery still requires a fresh challenge.

## Migration

Pause registration, profile edits, and recovery; back up and review the dry run.
The migration preserves accounts and shared emails. It normalizes addresses in
bounded batches, clears malformed historical email values, drops email-only
unique indexes on `mobileUsers`, and preserves its unique phone index.

It also replaces the email/purpose unique index on `mobileEmailOtps` with
`mobileEmailOtpsAccountPurposeUnique`. The new unique user/purpose index includes
only challenges with `flowIdHash`; legacy unbound challenges are not eligible
for recovery. No accounts or OTP records are deleted. The retired
`--create-index` option is rejected to prevent restoring email uniqueness.

From the repository root, with `MONGO_URI` supplied:

```sh
node backend/maintenance/recoveryEmailMigration.js --confirm-database YOUR_DATABASE
# Only during an approved maintenance window:
node backend/maintenance/recoveryEmailMigration.js --apply --confirm-database YOUR_DATABASE
```

Both schemas disable automatic index creation; provision the phone index
explicitly for a fresh database. Apply this migration before accepting new email
recovery requests. Restart/redeploy the API and update the mobile build together.
Old email-only mobile clients must restart recovery with the updated app; there
is deliberately no ambiguous fallback lookup by email.

Earlier duplicate cleanup removed email values from conflicting accounts. This
migration cannot reconstruct those deleted destinations; affected testers must
save their email again. Newly shared destinations are retained.

The removed anonymous cancellation endpoint remains removed. The legacy
email-exists endpoint returns a constant response for compatibility and is not
used by the current mobile recovery flow. Never return or log plaintext OTPs.
