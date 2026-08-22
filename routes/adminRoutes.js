import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { generalApiRateLimiter, writeActionRateLimiter } from '../middleware/rateLimiter.js';
import * as adminController from '../controllers/adminController.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/stats', generalApiRateLimiter, adminController.getStats);
router.get('/users', generalApiRateLimiter, adminController.getUsers);
router.get('/users/:id/activity', generalApiRateLimiter, adminController.getUserActivity);
router.patch('/users/:id/role', writeActionRateLimiter, adminController.updateUserRole);
router.patch('/users/:id/status', writeActionRateLimiter, adminController.setUserStatus);
router.post('/users/:id/ban', writeActionRateLimiter, adminController.banUser);
router.delete('/users/:id', writeActionRateLimiter, adminController.deleteUser);

router.get('/deletion-requests', generalApiRateLimiter, adminController.getDeletionRequests);
router.post('/deletion-requests/:id/approve', writeActionRateLimiter, adminController.approveDeletionRequest);
router.post('/deletion-requests/:id/reject', writeActionRateLimiter, adminController.rejectDeletionRequest);

export default router;
