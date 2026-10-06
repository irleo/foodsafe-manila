import MobileUser from "../models/MobileUser.js";
import bcrypt from "bcryptjs";
import { normalizePhone, sanitizeMobileUser } from "../utils/citizenAuth.js";
import { logRequestError } from "../utils/serverLogger.js";
import { EMAIL_UNAVAILABLE, isDuplicateRecoveryEmail, isValidRecoveryEmail, normalizeRecoveryEmail } from "../utils/recoveryEmail.js";
import { recoveryEmailTaken, requireRecoveryEmailIndex, updateRecoveryEmail } from "../services/recoveryEmailService.js";
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
    const originalEmail = mobileUser.email;
    const originalEmailVersion = mobileUser.emailVersion || 0;
    if (typeof email !== "undefined" && !isValidRecoveryEmail(email)) {
      return res.status(400).json({ message: "Enter a valid recovery email address." });
    }
    const emailChanged = typeof email !== "undefined" && normalizeRecoveryEmail(email) !== mobileUser.email;
    let phoneChanged = false;
    if (phone) {
      if (typeof phone !== "string" || !/^(?:09\d{9}|\+?639\d{9})$/.test(phone.trim())) {
        return res.status(400).json({ code: "PHONE_INVALID", message: "Enter a valid Philippine mobile number." });
      }
      phoneChanged = normalizePhone(phone) !== originalPhone;
    }
    if (emailChanged || phoneChanged) {
      const currentPassword = req.body.currentPassword;
      if (typeof currentPassword !== "string" || !currentPassword || currentPassword.length > 256) {
        return res.status(403).json({ code: "CURRENT_PASSWORD_REQUIRED", message: "Enter your current password to change recovery details." });
      }
      if (!await bcrypt.compare(currentPassword, mobileUser.password)) {
        return res.status(403).json({ code: "CURRENT_PASSWORD_INVALID", message: "Your current password is incorrect." });
      }
    }
    if (username) mobileUser.username = String(username).trim();

    if (phone) {
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
        expectedPasswordHash: mobileUser.password, expectedEmail: originalEmail, expectedEmailVersion: originalEmailVersion,
        profile: {
          username: mobileUser.username, email: mobileUser.email,
          emailVerified: mobileUser.emailVerified, emailVersion: mobileUser.emailVersion,
          ...(mobileUser.emailVerifiedAt ? { emailVerifiedAt: mobileUser.emailVerifiedAt } : {}),
        },
      });
      return res.status(200).json(sanitizeMobileUser(updated));
    }
    if (emailChanged) {
      const updated = await updateRecoveryEmail({ userId: String(req.user.id), originalEmail,
        emailVersion: originalEmailVersion, passwordHash: mobileUser.password,
        username: mobileUser.username, email: mobileUser.email });
      if (!updated) return res.status(409).json({ code: "PROFILE_CHANGED", message: "Your account changed. Reload your profile and try again." });
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
