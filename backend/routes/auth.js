import express from 'express';
import { 
  login, 
  logout, 
  refreshToken, 
  requestAccess,
} from '../controllers/authController.js';

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/refresh', refreshToken);
router.post("/request-access", requestAccess);

export default router;