const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

function getBrevoConfig() {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME || "FoodSafe Manila";

  if (!apiKey || !fromEmail) {
    throw new Error("Brevo API is not configured. Set BREVO_API_KEY and BREVO_FROM_EMAIL.");
  }

  return { apiKey, fromEmail, fromName };
}

async function sendBrevoEmail({ toEmail, subject, textContent }) {
  const { apiKey, fromEmail, fromName } = getBrevoConfig();

  const response = await fetch(BREVO_SEND_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { email: fromEmail, name: fromName },
      to: [{ email: toEmail }],
      subject,
      textContent,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Brevo API failed with ${response.status}: ${errorBody}`);
  }
}

export async function sendResetOtpEmail({ toEmail, otp, expiresMinutes = 10 }) {
  await sendBrevoEmail({
    toEmail,
    subject: "FoodSafe Manila Password Reset OTP",
    textContent:
      `Your FoodSafe Manila password reset OTP is: ${otp}\n\n` +
      `This code expires in ${expiresMinutes} minutes.\n` +
      "If you did not request a password reset, please ignore this email.",
  });
}

export async function sendAccessRequestOtpEmail({ toEmail, otp, expiresMinutes = 10 }) {
  await sendBrevoEmail({
    toEmail,
    subject: "FoodSafe Manila Access Request OTP",
    textContent:
      `Your FoodSafe Manila access request OTP is: ${otp}\n\n` +
      `This code expires in ${expiresMinutes} minutes.\n` +
      "If you did not request access to FoodSafe Manila, please ignore this email.",
  });
}