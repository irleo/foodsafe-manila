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
  assert.equal(getErrorMessage({ message: "file:///app/server.js?token=value" }), "The request could not be completed.");
});

test("stable backend codes map to module-safe messages", () => {
  assert.equal(
    getErrorMessage({ response: { data: { code: "PREDICTION_SERVICE_ERROR", message: LEAK } } }),
    "Prediction data is currently unavailable.",
  );
});

test("dataset upload code maps to a file-safe message", () => {
  assert.equal(getErrorMessage({ code: "DATASET_UPLOAD_ERROR" }), "The file could not be processed.");
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
      message: "The request could not be completed.",
      reference: "ERR-7F2A91AA",
    },
  );
});
