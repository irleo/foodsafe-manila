import MobileUser from "../models/MobileUser.js";
import { normalizePhone, sanitizeMobileUser } from "../utils/citizenAuth.js";
import { logRequestError } from "../utils/serverLogger.js";
import { EMAIL_UNAVAILABLE, isDuplicateRecoveryEmail, isValidRecoveryEmail, normalizeRecoveryEmail } from "../utils/recoveryEmail.js";
import { recoveryEmailTaken, requireRecoveryEmailIndex } from "../services/recoveryEmailService.js";
import { commitPhoneChange, PhoneChangeError } from "../services/phoneChangeOtpService.js";

// PUT /api/users/:id (citizen profile — mobile app)
export const updateMobileProfile = async (req, res) => {
  try {
    if (req.user?.accountType !== "citizen") {
      return res.status(403).json({ message: "Access denied" });
    }

    if (String(req.params.id) !== String(req.user.id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { username, phone, email } = req.body;
    const mobileUser = await MobileUser.findById(req.user.id);

    if (!mobileUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const originalPhone = mobileUser.phoneNumber;
    if (username) mobileUser.username = String(username).trim();

    if (phone) {
      if (typeof phone !== "string" || !/^(?:09\d{9}|\+?639\d{9})$/.test(phone.trim())) {
        return res.status(400).json({ code: "PHONE_INVALID", message: "Enter a valid Philippine mobile number." });
      }
      const normalizedPhone = normalizePhone(phone);
      if (normalizedPhone !== mobileUser.phoneNumber) {
        const taken = await MobileUser.exists({
          phoneNumber: normalizedPhone,
          _id: { $ne: mobileUser._id },
        });
        if (taken) {
          return res.status(409).json({ message: "Phone number already in use" });
        }
        mobileUser.phoneNumber = normalizedPhone;
      }
    }

    if (typeof email !== "undefined") {
      if (!isValidRecoveryEmail(email)) {
        return res.status(400).json({ message: "Enter a valid recovery email address." });
      }
      const normalizedEmail = normalizeRecoveryEmail(email);
      if (normalizedEmail !== mobileUser.email) {
        if (normalizedEmail) {
          if (await recoveryEmailTaken(normalizedEmail, mobileUser._id)) {
            return res.status(409).json(EMAIL_UNAVAILABLE);
          }
          await requireRecoveryEmailIndex();
        }
        mobileUser.email = normalizedEmail;
        mobileUser.emailVerified = false;
        mobileUser.emailVerifiedAt = undefined;
        mobileUser.emailVersion = (mobileUser.emailVersion || 0) + 1;
      }
    }

    if (mobileUser.phoneNumber !== originalPhone) {
      const updated = await commitPhoneChange({
        userId: String(req.user.id), phone: mobileUser.phoneNumber, originalPhone,
        flowId: req.body.flowId, otp: req.body.otp,
        profile: {
          username: mobileUser.username, email: mobileUser.email,
          emailVerified: mobileUser.emailVerified, emailVersion: mobileUser.emailVersion,
          ...(mobileUser.emailVerifiedAt ? { emailVerifiedAt: mobileUser.emailVerifiedAt } : {}),
        },
      });
      return res.status(200).json(sanitizeMobileUser(updated));
    }
    await mobileUser.save();
    return res.status(200).json(sanitizeMobileUser(mobileUser));
  } catch (error) {
    if (error instanceof PhoneChangeError) return res.status(error.status).json({ code: error.code, message: error.message });
    if (isDuplicateRecoveryEmail(error)) return res.status(409).json(EMAIL_UNAVAILABLE);
    if (error?.code === "RECOVERY_EMAIL_SETUP_REQUIRED") {
      return res.status(503).json({ code: error.code, message: error.message });
    }
    if (error?.code === 11000) return res.status(409).json({ message: "Phone number already in use" });
    logRequestError(error, req, "CITIZEN_PROFILE_ERROR");
    return res.status(500).json({ message: "Failed to update profile" });
  }
};
