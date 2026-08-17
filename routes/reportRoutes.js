import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { writeActionRateLimiter, generalApiRateLimiter } from '../middleware/rateLimiter.js';
import { createReport, getReports, updateReport } from '../controllers/reportController.js';

const router = Router();

// All reporting routes require authentication
router.use(requireAuth);

/**
 * POST /api/reports
 * Submit an abuse/conduct report on another user (FR-13).
 *
 * Body:
 *   {
 *     "reportedUserId": "<id>",
 *     "reason": "Harassment in chat"
 *   }
 */
router.post('/', writeActionRateLimiter, createReport);

/**
 * GET /api/reports
 * Admin: list reports queue with pagination and status filter (NFR-9).
 * Query: ?status=pending&page=1&limit=20
 */
router.get('/', requireRole('admin'), generalApiRateLimiter, getReports);

/**
 * PATCH /api/reports/:id
 * Admin: review report, update status, record action, and optionally block user.
 *
 * Body:
 *   {
 *     "status": "resolved",
 *     "adminNotes": "Confirmed abuse",
 *     "actionTaken": "Account suspended",
 *     "blockReportedUser": true
 *   }
 */
router.patch('/:id', requireRole('admin'), writeActionRateLimiter, updateReport);

export default router;
