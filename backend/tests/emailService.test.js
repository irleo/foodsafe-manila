import test from "node:test";
import assert from "node:assert/strict";
import { sendBrevoTemplateEmail } from "../services/emailService.js";

test("Brevo requests abort at the configured timeout", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.BREVO_API_KEY;
  const originalTimeout = process.env.BREVO_TIMEOUT_MS;
  process.env.BREVO_API_KEY = "test-key";
  process.env.BREVO_TIMEOUT_MS = "10";
  globalThis.fetch = async (_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });

  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.BREVO_API_KEY;
    else process.env.BREVO_API_KEY = originalApiKey;
    if (originalTimeout === undefined) delete process.env.BREVO_TIMEOUT_MS;
    else process.env.BREVO_TIMEOUT_MS = originalTimeout;
  });

  await assert.rejects(
    sendBrevoTemplateEmail({
      toEmail: "test@example.com",
      templateId: 1,
      params: { otp: "123456" },
    }),
    /timed out/,
  );
});
