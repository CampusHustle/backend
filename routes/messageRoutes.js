import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { generalApiRateLimiter } from '../middleware/rateLimiter.js';
import { getMessages, getMessagesByUser } from '../controllers/messageController.js';

const router = Router();

// All message routes require authentication
router.use(requireAuth);

/**
 * GET /api/messages/:conversationId
 * Fetch paginated message history for a known conversationId ("idA_idB").
 * Only participants can access. Chat must have a confirmed booking.
 *
 * Query: ?page=1&limit=50
 */
router.get('/:conversationId', generalApiRateLimiter, getMessages);

/**
 * GET /api/messages/conversation/:otherUserId
 * Convenience route: derive conversationId from the other user's ID.
 * Frontend just passes the other user's _id and gets messages back.
 *
 * Query: ?page=1&limit=50
 */
router.get('/conversation/:otherUserId', generalApiRateLimiter, getMessagesByUser);

export default router;
