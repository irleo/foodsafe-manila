import express from 'express';
import rateLimit from "express-rate-limit";
import {
  login,
  logout,
  refreshToken,
  requestAccess,
  sendRequestAccessOtp,
  forgotPassword,
  verifyResetOtp,
  completePasswordReset,
} from '../controllers/authController.js';
import {
  registerCitizen,
  checkPhoneExists,
  checkEmailExists,
  resetCitizenPassword,
  refreshCitizenToken,
} from '../controllers/citizenAuthController.js';
import {
  requestMobileOtp,
  confirmMobileOtp,
} from "../controllers/mobileOtpController.js";
import {
  requestEmailOtp,
  confirmEmailOtp,
  cancelEmailOtp,
} from "../controllers/mobileEmailOtpController.js";

const requestAccessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const mobileOtpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

const mobileOtpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const emailOtpSendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        return res.status(429).json({
            message: "Too many OTP requests. Please try again later.",
            retryAfterSeconds: Math.ceil(
                (req.rateLimit.resetTime.getTime() - Date.now()) / 1000
            ),
        });
    },
});

const emailOtpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/refresh', refreshToken);
router.post("/request-access/send-otp", requestAccessLimiter, sendRequestAccessOtp);
router.post("/request-access", requestAccessLimiter, requestAccess);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/verify-otp", verifyResetOtp);
router.post("/reset-password/complete", completePasswordReset);

// Citizen mobile auth (same /api/auth prefix as web)
router.post('/mobile/otp/send', mobileOtpSendLimiter, requestMobileOtp);
router.post('/mobile/otp/verify', mobileOtpVerifyLimiter, confirmMobileOtp);
router.post('/email/otp/send', emailOtpSendLimiter, requestEmailOtp);
router.post('/email/otp/verify', emailOtpVerifyLimiter, confirmEmailOtp);
router.post('/email/otp/cancel', cancelEmailOtp);
router.post('/register', registerCitizen);
router.get('/user/exists', checkPhoneExists);
router.get('/user/email-exists', checkEmailExists);
router.post('/reset-password', resetCitizenPassword);
router.post('/mobile/refresh', refreshCitizenToken);

export default router;
