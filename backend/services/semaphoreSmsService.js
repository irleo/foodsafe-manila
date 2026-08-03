function toPhilippineInternationalNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (/^09\d{9}$/.test(digits)) return `63${digits.slice(1)}`;
  if (/^639\d{9}$/.test(digits)) return digits;

  throw new Error("Invalid Philippine mobile number");
}

export async function sendSemaphoreSms({ phone, message }) {
  const apiKey = process.env.SEMAPHORE_API_KEY?.trim();
  const senderName = process.env.SEMAPHORE_SENDER_NAME?.trim();
  const sendUrl =
    process.env.SEMAPHORE_SMS_API_URL?.trim() ||
    "https://api.semaphore.co/api/v4/messages";

  if (!apiKey) {
    const error = new Error("Semaphore is not configured");
    error.code = "SEMAPHORE_NOT_CONFIGURED";
    throw error;
  }

  if (senderName && senderName.length > 11) {
    const error = new Error(
      "SEMAPHORE_SENDER_NAME must be 11 characters or fewer",
    );
    error.code = "SEMAPHORE_INVALID_CONFIG";
    throw error;
  }

  const body = new URLSearchParams({
    apikey: apiKey,
    number: toPhilippineInternationalNumber(phone),
    message,
  });

  if (senderName) body.set("sendername", senderName);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(sendUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: controller.signal,
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      // The HTTP status below still provides a safe failure signal.
    }

    const firstMessage = Array.isArray(data) ? data[0] : null;
    const rejectedStatus = ["failed", "refunded"].includes(
      String(firstMessage?.status || "").toLowerCase(),
    );

    if (!response.ok || !firstMessage || rejectedStatus) {
      const providerMessage =
        data?.message ||
        data?.error ||
        firstMessage?.status ||
        "Semaphore rejected the message";
      const error = new Error(String(providerMessage));
      error.code =
        response.status === 401 || response.status === 403
          ? "SEMAPHORE_AUTH_FAILED"
          : "SEMAPHORE_SEND_FAILED";
      error.status = response.status;
      throw error;
    }

    return firstMessage;
  } finally {
    clearTimeout(timeout);
  }
}
