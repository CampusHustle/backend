import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Apply auth rate limiter to mutation/login routes (NFR-2, DoS mitigation)
router.post('/register', authRateLimiter, authController.register);
router.post('/login', authRateLimiter, authController.login);
router.post('/verify-email', authController.verifyEmail);
router.post('/refresh', authController.refresh);

export default router;
