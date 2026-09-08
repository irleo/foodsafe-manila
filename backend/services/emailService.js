const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";
const DEFAULT_BREVO_TIMEOUT_MS = 5_000;

function brevoTimeoutMs() {
  const configured = Number(process.env.BREVO_TIMEOUT_MS);
  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_BREVO_TIMEOUT_MS;
}

export async function sendBrevoTemplateEmail({
  toEmail,
  templateId,
  params,
}) {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey || !templateId) {
    throw new Error("Brevo API key or template ID is missing.");
  }

  let response;
  try {
    response = await fetch(BREVO_SEND_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        templateId: Number(templateId),
        to: [{ email: toEmail }],
        params,
      }),
      signal: AbortSignal.timeout(brevoTimeoutMs()),
    });
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      throw new Error("Brevo API request timed out.", { cause: error });
    }
    throw error;
  }

  if (!response.ok) {
    throw new Error(`Brevo API failed: ${await response.text()}`);
  }
}

export async function sendResetOtpEmail({
  toEmail,
  otp,
  expiresMinutes = 10,
}) {
  await sendBrevoTemplateEmail({
    toEmail,
    templateId: process.env.BREVO_RESET_OTP_TEMPLATE_ID,
    params: {
      otp,
      expiresMinutes,
    },
  });
}

export async function sendAccessRequestOtpEmail({
  toEmail,
  otp,
  expiresMinutes = 10,
}) {
  await sendBrevoTemplateEmail({
    toEmail,
    templateId: process.env.BREVO_ACCESS_OTP_TEMPLATE_ID,
    params: {
      otp,
      expiresMinutes,
    },
  });
}
