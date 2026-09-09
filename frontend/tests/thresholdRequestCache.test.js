import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchCurrentThreshold,
  updateThresholdSettings,
} from "../src/api/thresholds.js";

function jsonResponse(payload) {
  return {
    ok: true,
    async json() {
      return payload;
    },
  };
}

test("identical concurrent threshold reads share one request", async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return jsonResponse({ result: { district: "District 1" } });
  };

  try {
    const options = { disease: "Cholera", district: "District 1" };
    const [first, second] = await Promise.all([
      fetchCurrentThreshold("cache-test-token", "dataset-cache-test", options),
      fetchCurrentThreshold("cache-test-token", "dataset-cache-test", options),
    ]);

    assert.equal(requestCount, 1);
    assert.deepEqual(first, second);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("different district requests remain isolated", async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return jsonResponse({ result: {} });
  };

  try {
    await Promise.all([
      fetchCurrentThreshold("isolation-test-token", "dataset-isolation-test", {
        disease: "Cholera",
        district: "District 1",
      }),
      fetchCurrentThreshold("isolation-test-token", "dataset-isolation-test", {
        disease: "Cholera",
        district: "District 2",
      }),
    ]);

    assert.equal(requestCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("updating settings invalidates cached threshold reads", async () => {
  const originalFetch = globalThis.fetch;
  let currentRequestCount = 0;
  globalThis.fetch = async (url, options = {}) => {
    if (options.method === "PUT") return jsonResponse({ settings: {} });
    currentRequestCount += 1;
    return jsonResponse({ result: {} });
  };

  try {
    const options = { disease: "Rotavirus", district: "District 3" };
    await fetchCurrentThreshold("invalidation-test-token", "dataset-invalidation-test", options);
    await updateThresholdSettings("invalidation-test-token", {});
    await fetchCurrentThreshold("invalidation-test-token", "dataset-invalidation-test", options);

    assert.equal(currentRequestCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
