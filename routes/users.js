import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { generalApiRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Public: canonical skill tags list for FR-3 tag picker (must precede /:id)
router.get('/skills', userController.getSkillTags);

// Protected profile routes for current authenticated user
router.get('/me', requireAuth, userController.getMe);
router.put('/me', requireAuth, userController.updateMe);

// Public or authenticated tutor search with rate limiting (must precede /:id parameter route)
router.get('/search', generalApiRateLimiter, userController.searchTutors);

// Peer user blocking (FR-13)
router.post('/block/:id', requireAuth, userController.blockUser);
router.delete('/block/:id', requireAuth, userController.unblockUser);

// Admin account status moderation (FR-13, NFR-9)
router.patch('/:id/status', requireAuth, requireRole('admin'), userController.adminSetUserStatus);

// Public user/tutor profile lookup
router.get('/:id', userController.getUserById);

export default router;


