const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";


async function sendBrevoTemplateEmail({
  toEmail,
  templateId,
  params,
}) {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey || !templateId) {
    throw new Error("Brevo API key or template ID is missing.");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
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
  });

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