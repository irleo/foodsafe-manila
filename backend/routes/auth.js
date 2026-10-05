import express from 'express';
import { verifyToken, requireCitizenAccount } from "../middleware/authMiddleware.js";
import { getMobilePolicies, getMobilePolicyStatus, acceptMobilePolicies, acceptReportingPolicies } from "../controllers/mobilePolicyController.js";
import rateLimit from "express-rate-limit";
import { requestPhoneChangeOtp } from "../controllers/phoneChangeOtpController.js";
import { requireCurrentMobilePolicies } from "../controllers/mobilePolicyController.js";
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
  requestRecoveryEmailOtp,
  confirmRecoveryEmailOtp,
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
  handler: (req, res) => res.status(429).json({ message: "Too many code requests. Please try again later.",
    retryAfterSeconds: Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000)) }),
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
router.get('/mobile/policies', getMobilePolicies);
router.get('/mobile/policies/status', verifyToken, requireCitizenAccount, getMobilePolicyStatus);
router.post('/mobile/policies/accept', verifyToken, requireCitizenAccount, acceptMobilePolicies);
router.post('/mobile/policies/reporting/accept', verifyToken, requireCitizenAccount, requireCurrentMobilePolicies, acceptReportingPolicies);

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
router.post('/mobile/phone-change/otp/send', verifyToken, requireCitizenAccount, requireCurrentMobilePolicies, mobileOtpSendLimiter, requestPhoneChangeOtp);
router.post('/email/otp/send', emailOtpSendLimiter, requestEmailOtp);
router.post('/email/otp/verify', emailOtpVerifyLimiter, confirmEmailOtp);
router.post('/mobile/recovery-email/otp/send', verifyToken, requireCitizenAccount, emailOtpSendLimiter, requestRecoveryEmailOtp);
router.post('/mobile/recovery-email/otp/verify', verifyToken, requireCitizenAccount, emailOtpVerifyLimiter, confirmRecoveryEmailOtp);
router.post('/register', registerCitizen);
router.get('/user/exists', checkPhoneExists);
router.get('/user/email-exists', checkEmailExists);
router.post('/reset-password', resetCitizenPassword);
router.post('/mobile/refresh', refreshCitizenToken);

export default router;
