// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import MobileUser from "../models/MobileUser.js";
import { refreshCitizenToken } from "../controllers/citizenAuthController.js";

/** @param {string} refreshToken */
async function refresh(refreshToken) {
  const result = { statusCode: 200, body: /** @type {Record<string, unknown> | null} */ (null),
    /** @param {number} code */ status(code) { this.statusCode = code; return this; },
    /** @param {Record<string, unknown>} body */ json(body) { this.body = body; return this; } };
  await refreshCitizenToken({ body: { refreshToken } }, result);
  return result;
}

test("mobile refresh distinguishes database outage from rejected credentials", async (t) => {
  t.mock.method(jwt, "verify", () => ({ id: "citizen", accountType: "citizen", tokenVersion: 0 }));
  t.mock.method(MobileUser, "findById", async () => { throw new Error("Mock database outage"); });
  t.mock.method(console, "error", () => undefined);
  const result = await refresh("mock-token");
  assert.equal(result.statusCode, 500);
  assert.equal(result.body?.code, "AUTHENTICATION_ERROR");
  assert.ok(!String(result.body?.message).includes("database"));
});

for (const error of [new jwt.JsonWebTokenError("bad"), new jwt.TokenExpiredError("expired", new Date()), new jwt.NotBeforeError("future", new Date())]) {
  test(`mobile refresh ${error.name} is a definitive credential rejection`, async (t) => {
    t.mock.method(jwt, "verify", () => { throw error; });
    assert.equal((await refresh("mock-token")).statusCode, 401);
  });
}

test("revoked refresh still rejects the old token version", async (t) => {
  t.mock.method(jwt, "verify", () => ({ id: "citizen", accountType: "citizen", tokenVersion: 0 }));
  t.mock.method(MobileUser, "findById", async () => ({ tokenVersion: 1 }));
  assert.equal((await refresh("mock-token")).statusCode, 401);
});
