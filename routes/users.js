import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';
import { generalApiRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Public: canonical skill tags list for FR-3 tag picker (must precede /:id)
router.get('/skills', userController.getSkillTags);

// Protected profile routes for current authenticated user
router.get('/me', requireAuth, userController.getMe);
router.put('/me', requireAuth, userController.updateMe);

// Public or authenticated tutor search with rate limiting (must precede /:id parameter route)
router.get('/search', generalApiRateLimiter, userController.searchTutors);

// Public user/tutor profile lookup
router.get('/:id', userController.getUserById);

export default router;
