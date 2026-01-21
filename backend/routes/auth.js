import express from 'express';
import rateLimit from "express-rate-limit";
import { 
  login, 
  logout, 
  refreshToken, 
  requestAccess,
} from '../controllers/authController.js';

const requestAccessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/refresh', refreshToken);
router.post("/request-access", requestAccessLimiter, requestAccess);

export default router;