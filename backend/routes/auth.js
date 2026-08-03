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
  resetCitizenPassword,
  refreshCitizenToken,
} from '../controllers/citizenAuthController.js';
import {
  requestMobileOtp,
  confirmMobileOtp,
} from "../controllers/mobileOtpController.js";

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
router.post('/register', registerCitizen);
router.get('/user/exists', checkPhoneExists);
router.post('/reset-password', resetCitizenPassword);
router.post('/mobile/refresh', refreshCitizenToken);

export default router;
