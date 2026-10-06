import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";

import AppError from "../errors/AppError.js";
import {
  errorHandler,
  notFoundHandler,
  requestContext,
  standardizeErrorResponses,
} from "../middleware/errorHandler.js";
import { sanitizePredictionPayload } from "../controllers/predictionController.js";

const LEAK = "Traceback ModuleNotFoundError C:\\Users\\person\\forecast.py:19 node_modules mongoose mongodb+srv://user:password@example.test/database";
const FORBIDDEN = /traceback|modulenotfounderror|c:\\users\\|\/home\/|\.js:\d+|\.py:\d+|mongodb(?:\+srv)?:\/\/|node_modules|mongoose/i;
const MODULE_PATHS = [
  "/api/dashboard/leak",
  "/api/activity/leak",
  "/api/datasets/upload",
  "/api/datasets/leak",
  "/api/datasets/file/leak",
  "/api/reports/leak",
  "/api/heatmap/leak",
  "/api/risk/heatmap/leak",
  "/api/analytics/leak",
  "/api/official-cases/analytics/leak",
  "/api/cases/leak",
  "/api/predictions/leak",
  "/api/thresholds/leak",
  "/api/users/leak",
  "/api/notifications/leak",
  "/api/auth/leak",
  "/api/mobile/leak",
];
const ACTION_FAILURES = [
  ["PUT", "/api/users/citizen", "We couldn't save your account changes. Please try again."],
  ["POST", "/api/auth/register", "We couldn't create your account. Please try again later."],
  ["POST", "/api/auth/login", "Sign-in is temporarily unavailable. Please try again later."],
  ["POST", "/api/auth/mobile/otp/send", "We couldn't send a verification code right now. Please wait a moment and try again."],
  ["POST", "/api/auth/email/otp/verify", "We couldn't check your verification code. Please try again before it expires."],
  ["POST", "/api/auth/reset-password", "We couldn't change your password. Please try again; request a new code if yours has expired."],
  ["POST", "/api/auth/mobile/policies/accept", "We couldn't save your policy acknowledgement. Please try again."],
  ["POST", "/api/reports", "We couldn't save your report. Check your report history before trying again."],
  ["GET", "/api/reports/user/citizen/last", "We couldn't check when you last submitted a report. Please try again."],
  ["PATCH", "/api/notifications/read-all", "We couldn't update your notifications. Please try again."],
  ["POST", "/api/predictions/refresh", "We couldn't start the forecast refresh. Please try again later."],
  ["GET", "/api/insights/predictions", "We couldn't load the forecasts. Please refresh and try again."],
  ["GET", "/api/insights/analytics", "We couldn't load the health insights. Please refresh and try again."],
];

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.disable("x-powered-by");
  app.use(requestContext);
  app.use(standardizeErrorResponses);

  for (const path of MODULE_PATHS) {
    app[path === "/api/datasets/upload" ? "post" : "get"](path, () => {
      throw new Error(LEAK);
    });
  }
  for (const [method, path] of ACTION_FAILURES) {
    app[method.toLowerCase()](path, (_req, res) => res.status(500).json({ message: LEAK }));
  }
  app.put("/api/users/setup", (_req, res) => res.status(503).json({ code: "RECOVERY_EMAIL_SETUP_REQUIRED", message: LEAK }));
  app.put("/api/users/thrown-setup", () => { throw Object.assign(new Error(LEAK), { status: 503, code: "RECOVERY_EMAIL_SETUP_REQUIRED" }); });
  app.get("/api/status/:status", (req, res) => res.status(Number(req.params.status)).json({ message: LEAK }));
  app.post("/api/users/password", (_req, res) => res.status(403).json({ code: "CURRENT_PASSWORD_INVALID", message: "Your current password is incorrect." }));
  app.get("/api/caught/leak", (req, res) => {
    res.status(500).json({ message: LEAK, error: { stack: LEAK } });
  });
  app.get("/api/validation/safe", () => {
    throw new AppError("Column 'Disease' is required.", {
      status: 400,
      code: "VALIDATION_ERROR",
    });
  });
  app.get("/api/validation/unsafe", (req, res) => {
    res.status(400).json({
      message: LEAK,
      datasetId: { raw: LEAK },
      validationErrors: [{ row: 2, field: "/app/private/parser.js", message: LEAK }],
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

for (const path of MODULE_PATHS) {
  test(`unexpected ${path} failure is safe`, async () => {
    const response = await fetch(`${baseUrl}${path}`, { method: path === "/api/datasets/upload" ? "POST" : "GET" });
    const body = await response.json();
    const serialized = JSON.stringify(body);

    assert.equal(response.status, 500);
    assert.equal(body.success, false);
    assert.match(body.code, /^[A-Z][A-Z0-9_]+$/);
    assert.match(body.errorId, /^ERR-[A-F0-9]{8}$/);
    assert.equal(FORBIDDEN.test(serialized), false);
    assert.equal(response.headers.get("x-request-id"), body.errorId);
  });
}

test("caught 500 responses are replaced with a safe envelope", async () => {
  const response = await fetch(`${baseUrl}/api/caught/leak`);
  const body = await response.json();
  assert.equal(response.status, 500);
  assert.equal(body.success, false);
  assert.equal(FORBIDDEN.test(JSON.stringify(body)), false);
  assert.equal("error" in body, false);
});

test("dataset upload failures use the upload-safe mapping", async () => {
  const response = await fetch(`${baseUrl}/api/datasets/upload`, { method: "POST" });
  const body = await response.json();
  assert.equal(body.code, "DATASET_UPLOAD_ERROR");
  assert.equal(body.message, "We couldn't process this file. Check the upload list before trying again.");
});

test("operational validation messages remain specific", async () => {
  const response = await fetch(`${baseUrl}/api/validation/safe`);
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.message, "Column 'Disease' is required.");
  assert.equal(body.code, "VALIDATION_ERROR");
});

test("unsafe validation details are sanitized", async () => {
  const response = await fetch(`${baseUrl}/api/validation/unsafe`);
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.message, "Please check the information you entered and try again.");
  assert.equal(body.validationErrors[0].message, "This row could not be validated.");
  assert.equal("field" in body.validationErrors[0], false);
  assert.equal("datasetId" in body, false);
  assert.equal(FORBIDDEN.test(JSON.stringify(body)), false);
});

test("unknown routes do not echo paths or query strings", async () => {
  const response = await fetch(`${baseUrl}/missing/${encodeURIComponent(LEAK)}?token=secret`);
  const body = await response.json();
  assert.equal(response.status, 404);
  assert.equal(body.message, "This feature is not available. Please update the app or contact the test administrator.");
  assert.equal("path" in body, false);
  assert.equal(response.headers.has("x-powered-by"), false);
  assert.equal(FORBIDDEN.test(JSON.stringify(body)), false);
});

for (const [method, path, message] of ACTION_FAILURES) {
  test(`${method} ${path} failure describes the action and next step`, async () => {
    const response = await fetch(`${baseUrl}${path}`, { method });
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.equal(body.message, message);
    assert.equal(FORBIDDEN.test(JSON.stringify(body)), false);
    assert.match(body.errorId, /^ERR-[A-F0-9]{8}$/);
  });
}

test("trailing slashes and query strings retain the OTP action message", async () => {
  const response = await fetch(`${baseUrl}/api/auth/mobile/otp/send/?ignored=example`, { method: "POST" });
  const body = await response.json();
  assert.equal(body.message, "We couldn't send a verification code right now. Please wait a moment and try again.");
});

test("known recovery setup failure is actionable without leaking setup details", async () => {
  for (const path of ["setup", "thrown-setup"]) {
    const response = await fetch(`${baseUrl}/api/users/${path}`, { method: "PUT" });
    const body = await response.json();
    assert.equal(body.code, "RECOVERY_EMAIL_SETUP_REQUIRED");
    assert.equal(body.message, "Recovery email changes are temporarily unavailable. Please try again later.");
    assert.equal(FORBIDDEN.test(JSON.stringify(body)), false);
  }
});

test("wrong password remains specific rather than becoming an access or server error", async () => {
  const response = await fetch(`${baseUrl}/api/users/password`, { method: "POST" });
  const body = await response.json();
  assert.equal(body.code, "CURRENT_PASSWORD_INVALID");
  assert.equal(body.message, "Your current password is incorrect.");
  assert.equal("errorId" in body, false);
});

for (const status of [401, 403, 404, 409, 413, 429]) {
  test(`unusable ${status} error has a safe next step`, async () => {
    const response = await fetch(`${baseUrl}/api/status/${status}`);
    const body = await response.json();
    assert.match(body.message, /Please|Choose/);
    assert.equal(FORBIDDEN.test(JSON.stringify(body)), false);
  });
}

test("legacy Python errors in saved prediction payloads are sanitized", () => {
  const payload = sanitizePredictionPayload({
    diseases: [{
      districts: [{
        models: { prophet: { status: "failed", message: LEAK, stack: LEAK } },
      }],
    }],
  });
  const serialized = JSON.stringify(payload);
  assert.equal(FORBIDDEN.test(serialized), false);
  assert.equal("stack" in payload.diseases[0].districts[0].models.prophet, false);
  assert.equal(
    payload.diseases[0].districts[0].models.prophet.message,
    "Prediction unavailable. The forecasting service encountered an error. Please try again later.",
  );
});
