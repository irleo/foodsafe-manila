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

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.disable("x-powered-by");
  app.use(requestContext);
  app.use(standardizeErrorResponses);

  for (const path of MODULE_PATHS) {
    app.get(path, () => {
      throw new Error(LEAK);
    });
  }
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
    const response = await fetch(`${baseUrl}${path}`);
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
  const response = await fetch(`${baseUrl}/api/datasets/upload`);
  const body = await response.json();
  assert.equal(body.code, "DATASET_UPLOAD_ERROR");
  assert.equal(body.message, "The file could not be processed.");
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
  assert.equal(body.message, "The request could not be completed.");
  assert.equal(body.validationErrors[0].message, "This row could not be validated.");
  assert.equal("field" in body.validationErrors[0], false);
  assert.equal("datasetId" in body, false);
  assert.equal(FORBIDDEN.test(JSON.stringify(body)), false);
});

test("unknown routes do not echo paths or query strings", async () => {
  const response = await fetch(`${baseUrl}/missing/${encodeURIComponent(LEAK)}?token=secret`);
  const body = await response.json();
  assert.equal(response.status, 404);
  assert.equal(body.message, "Route not found.");
  assert.equal("path" in body, false);
  assert.equal(response.headers.has("x-powered-by"), false);
  assert.equal(FORBIDDEN.test(JSON.stringify(body)), false);
});

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
