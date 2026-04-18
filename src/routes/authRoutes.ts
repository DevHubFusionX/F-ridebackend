import express from 'express';
import {
  register,
  login,
  requestOTP,
  verifyOTP,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  toggle2FA,
  joinWaitlist,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/request-otp', requestOTP);
router.post('/verify-otp', verifyOTP);
router.post('/waitlist', joinWaitlist);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', protect, getMe);
router.put('/me', protect, updateProfile);
router.post('/change-password', protect, changePassword);
router.post('/toggle-2fa', protect, toggle2FA);

export default router;

