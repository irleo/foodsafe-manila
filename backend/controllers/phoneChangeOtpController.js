// @ts-check
import { normalizePhone } from "../utils/citizenAuth.js";
import { sendPhoneChangeOtp, PhoneChangeError, validPhoneChangeFlow } from "../services/phoneChangeOtpService.js";
import { logRequestError } from "../utils/serverLogger.js";

/** @param {import('express').Request & {user?: {id: string, accountType: string}}} req @param {import('express').Response} res */
export async function requestPhoneChangeOtp(req, res) {
  if (req.user?.accountType !== "citizen") return res.status(403).json({ message: "Access denied" });
  let phone;
  try {
    if (typeof req.body?.phone !== "string" || !/^(?:09\d{9}|\+?639\d{9})$/.test(req.body.phone.trim())) throw new Error("Invalid phone");
    phone = normalizePhone(req.body.phone.trim());
  } catch (error) {
    return res.status(400).json({ code: "PHONE_INVALID", message: "Enter a valid Philippine mobile number." });
  }
  if (req.body?.flowId != null && !validPhoneChangeFlow(req.body.flowId)) {
    return res.status(400).json({ code: "OTP_FLOW_INVALID", message: "Start verification again." });
  }
  try {
    return res.json(await sendPhoneChangeOtp({ userId: req.user.id, phone, flowId: req.body?.flowId }));
  } catch (error) {
    if (error instanceof PhoneChangeError) {
      if (error.retryAfterSeconds) res.set("Retry-After", String(error.retryAfterSeconds));
      return res.status(error.status).json({ code: error.code, message: error.message, retryAfterSeconds: error.retryAfterSeconds });
    }
    logRequestError(error, req, "PHONE_CHANGE_SEND_ERROR");
    return res.status(502).json({ message: "Verification code could not be sent. Please try again later." });
  }
}
