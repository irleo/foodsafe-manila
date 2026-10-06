import assert from "node:assert/strict";
import test from "node:test";

import {
  getErrorDisplay,
  getErrorMessage,
} from "../src/utils/errors.js";

const LEAK = "Traceback ModuleNotFoundError C:\\Users\\person\\forecast.py:19 node_modules mongoose mongodb+srv://user:password@example.test/database";

test("technical API details are replaced", () => {
  assert.equal(
    getErrorMessage({ response: { data: { message: LEAK } } }, "Safe fallback."),
    "Safe fallback.",
  );
});

test("source paths and query fragments are replaced", () => {
  assert.equal(getErrorMessage({ message: "file:///app/server.js?token=value" }), "We couldn't complete this action. Please try again later.");
});

test("stable backend codes map to module-safe messages", () => {
  assert.equal(
    getErrorMessage({ response: { data: { code: "PREDICTION_SERVICE_ERROR", message: LEAK } } }),
    "We couldn't load the forecasts. Please refresh and try again.",
  );
});

test("dataset upload code maps to a file-safe message", () => {
  assert.equal(getErrorMessage({ code: "DATASET_UPLOAD_ERROR" }), "We couldn't process this file. Check the upload list before trying again.");
});

test("safe validation feedback remains visible", () => {
  assert.equal(
    getErrorMessage({ response: { data: { code: "VALIDATION_ERROR", message: "Column 'Disease' is required." } } }),
    "Column 'Disease' is required.",
  );
});

test("error references are preserved separately", () => {
  assert.deepEqual(
    getErrorDisplay({ response: { data: { code: "INTERNAL_ERROR", message: LEAK, errorId: "ERR-7F2A91AA" } } }),
    {
      message: "We couldn't complete this action. Please try again later.",
      reference: "ERR-7F2A91AA",
    },
  );
});

test("module codes do not overwrite actionable server and validation messages", () => {
  for (const [code, message] of [
    ["USER_SERVICE_ERROR", "We couldn't save your account changes. Please try again."],
    ["AUTHENTICATION_ERROR", "Your sign-in details are incorrect. Please check them and try again."],
    ["REPORT_SERVICE_ERROR", "We couldn't save your report. Check your report history before trying again."],
  ]) assert.equal(getErrorMessage({ response: { data: { code, message } } }), message);
});

test("connection and rate-limit failures give recovery guidance", () => {
  assert.match(getErrorMessage({ code: "ERR_NETWORK", message: "Network Error" }), /Check your connection/);
  assert.match(getErrorMessage({ code: "ECONNABORTED" }), /too long/);
  assert.match(getErrorMessage({ response: { status: 429, data: {} } }), /wait before trying/);
});

test("legacy generic account errors use the caller's save guidance", () => {
  assert.equal(getErrorMessage({ response: { data: { code: "USER_SERVICE_ERROR", message: "User data could not be loaded." } } }, "We couldn't save your account changes. Please try again."),
    "We couldn't save your account changes. Please try again.");
});
