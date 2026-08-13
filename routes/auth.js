import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Public authentication routes (rate limited)
router.post('/register', authRateLimiter, authController.register);
router.post('/login', authRateLimiter, authController.login);

// Email verification routes
router.post('/verify-email', authController.verifyEmail);
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);

// Token management routes
router.post('/refresh', authController.refresh);
router.post('/logout', requireAuth, authController.logout);

export default router;
