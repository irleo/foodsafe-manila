async function createTransporter() {
  const { default: nodemailer } = await import("nodemailer");

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

  if (!host || !user || !pass) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendResetOtpEmail({ toEmail, otp, expiresMinutes = 10 }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const transporter = await createTransporter();

  const subject = "FoodSafe Manila Password Reset OTP";
  const text =
    `Your FoodSafe Manila password reset OTP is: ${otp}\n\n` +
    `This code expires in ${expiresMinutes} minutes.\n` +
    "If you did not request a password reset, please ignore this email.";

  await transporter.sendMail({
    from,
    to: toEmail,
    subject,
    text,
  });
}
