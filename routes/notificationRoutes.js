import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { generalApiRateLimiter, writeActionRateLimiter } from '../middleware/rateLimiter.js';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '../controllers/notificationController.js';

const router = Router();

/**
 * GET /api/notifications
 * Fetch user notifications with pagination and unread filter.
 */
router.get('/', generalApiRateLimiter, requireAuth, getNotifications);

/**
 * GET /api/notifications/unread-count
 * Get unread notification count.
 */
router.get('/unread-count', generalApiRateLimiter, requireAuth, getUnreadNotificationCount);

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read.
 */
router.patch('/read-all', writeActionRateLimiter, requireAuth, markAllNotificationsAsRead);

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
router.patch('/:id/read', writeActionRateLimiter, requireAuth, markNotificationAsRead);

export default router;
