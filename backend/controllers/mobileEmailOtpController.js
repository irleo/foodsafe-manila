import crypto from "crypto";
import MobileUser from "../models/MobileUser.js";
import MobileEmailOtp from "../models/MobileEmailOtp.js";
import { sendResetOtpEmail } from "../services/emailService.js";
import { logRequestError } from "../utils/serverLogger.js";

const PURPOSES = new Set(["password_reset"]);
const OTP_TTL_MS = 5 * 60 * 1000;
const VERIFICATION_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function hashValue(value) {
    const secret =
        process.env.OTP_HASH_SECRET || process.env.ACCESS_TOKEN_SECRET || "";

    return crypto
        .createHmac("sha256", secret)
        .update(value)
        .digest("hex");
}

function hashOtp({ email, purpose, otp }) {
    return hashValue(`email-otp:${email}:${purpose}:${otp}`);
}

function hashVerificationToken(token) {
    return hashValue(`email-verification:${token}`);
}

function safeHashEquals(left, right) {
    if (!left || !right || left.length !== right.length) return false;

    return crypto.timingSafeEqual(
        Buffer.from(left),
        Buffer.from(right),
    );
}

function parseRequest(req, res) {
    const email = normalizeEmail(req.body?.email);
    const purpose = req.body?.purpose;

    if (!email || !PURPOSES.has(purpose)) {
        res.status(400).json({
            message: "Valid email and purpose are required",
        });
        return null;
    }

    return { email, purpose };
}

export const requestEmailOtp = async (req, res) => {
    const request = parseRequest(req, res);
    if (!request) return;

    try {
        const existingUser = await MobileUser.exists({
            email: request.email,
        });

        if (!existingUser) {
            return res.status(404).json({
                message: "Email address is not registered",
            });
        }

        const now = new Date();
        const existingOtp = await MobileEmailOtp.findOne(request);

        if (
            existingOtp?.lastSentAt &&
            now.getTime() - new Date(existingOtp.lastSentAt).getTime() <
            60 * 1000
        ) {
            return res.status(429).json({
                message: "Please wait before requesting another code",
            });
        }

        const otp = crypto
            .randomInt(0, 1000000)
            .toString()
            .padStart(6, "0");

        const isProd = process.env.NODE_ENV === "production";
        let usedDevFallback = false;

        try {
            await sendResetOtpEmail({
                toEmail: request.email,
                otp,
                expiresMinutes: 5,
            });
        } catch (mailError) {
            logRequestError(mailError, req, "MOBILE_EMAIL_OTP_DELIVERY_ERROR");

            if (isProd) throw mailError;

            usedDevFallback = true;
            console.warn(
                `Mobile email OTP fallback for ${request.email}: ${otp}`,
            );
        }

        await MobileEmailOtp.findOneAndUpdate(
            request,
            {
                $set: {
                    otpHash: hashOtp({
                        email: request.email,
                        purpose: request.purpose,
                        otp,
                    }),
                    verificationTokenHash: null,
                    verifiedAt: null,
                    consumedAt: null,
                    attempts: 0,
                    lastSentAt: now,
                    expiresAt: new Date(now.getTime() + OTP_TTL_MS),
                },
            },
            { upsert: true, runValidators: true },
        );

        return res.json({
            message: "Verification code sent",
            expiresInSeconds: OTP_TTL_MS / 1000,
            ...(usedDevFallback
                ? {
                    devFallback: true,
                    debugOtp: otp,
                    debugExpiresSeconds: OTP_TTL_MS / 1000,
                }
                : {}),
        });
    } catch (error) {
        logRequestError(error, req, "MOBILE_EMAIL_OTP_SEND_ERROR");
        return res.status(502).json({
            message: "Failed to send verification code",
        });
    }
};

export const confirmEmailOtp = async (req, res) => {
    const request = parseRequest(req, res);
    if (!request) return;

    const otp = String(req.body?.otp || "").trim();

    if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({
            message: "Enter the 6-digit verification code",
        });
    }

    try {
        const record = await MobileEmailOtp.findOne(request).select(
            "+otpHash +verificationTokenHash",
        );

        if (
            !record ||
            !record.otpHash ||
            record.expiresAt <= new Date() ||
            record.consumedAt
        ) {
            return res.status(400).json({
                message: "Verification code is invalid or expired",
            });
        }

        if (record.attempts >= MAX_ATTEMPTS) {
            return res.status(429).json({
                message: "Too many incorrect attempts. Request a new code",
            });
        }

        const expectedHash = hashOtp({
            email: request.email,
            purpose: request.purpose,
            otp,
        });

        if (!safeHashEquals(record.otpHash, expectedHash)) {
            record.attempts += 1;
            await record.save();

            return res.status(400).json({
                message: "Verification code is invalid or expired",
            });
        }

        const verificationToken = crypto.randomBytes(32).toString("hex");

        record.otpHash = null;
        record.verifiedAt = new Date();
        record.verificationTokenHash = hashVerificationToken(
            verificationToken,
        );
        record.expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

        await record.save();

        return res.json({
            verificationToken,
            expiresInSeconds: VERIFICATION_TTL_MS / 1000,
        });
    } catch (error) {
        logRequestError(error, req, "MOBILE_EMAIL_OTP_VERIFY_ERROR");
        return res.status(500).json({
            message: "Failed to verify code",
        });
    }
};

export const cancelEmailOtp = async (req, res) => {
    const request = parseRequest(req, res);
    if (!request) return;

    try {
        await MobileEmailOtp.findOneAndUpdate(
            request,
            {
                $set: {
                    otpHash: null,
                    verificationTokenHash: null,
                    verifiedAt: null,
                    consumedAt: null,
                    attempts: 0,
                    lastSentAt: null,
                    expiresAt: new Date(),
                },
            },
            { new: true },
        );

        return res.json({
            message: "Verification code cancelled",
        });
    } catch (error) {
        logRequestError(error, req, "MOBILE_EMAIL_OTP_CANCEL_ERROR");

        return res.status(500).json({
            message: "Failed to cancel verification code",
        });
    }
};