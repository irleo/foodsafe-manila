import test from "node:test";
import assert from "node:assert/strict";
import { generateOtp } from "../controllers/authController.js";
import { isTokenVersionCurrent } from "../utils/tokenVersion.js";

test("OTP generation produces fixed-width numeric CSPRNG values with healthy uniqueness", () => {
  const values = Array.from({ length: 1_000 }, () => generateOtp(6));
  assert.ok(values.every((value) => /^\d{6}$/.test(value)));
  assert.ok(new Set(values).size >= 990);
});

test("password-reset token version rejects previously issued tokens", () => {
  const issuedVersion = 0;
  assert.equal(isTokenVersionCurrent(issuedVersion, 0), true);
  assert.equal(isTokenVersionCurrent(issuedVersion, 1), false);
  assert.equal(isTokenVersionCurrent(undefined, 0), false);
});
