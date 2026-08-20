import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { generalApiRateLimiter } from '../middleware/rateLimiter.js';
import { getMessages, getMessagesByUser, getConversations } from '../controllers/messageController.js';

const router = Router();

// All message routes require authentication
router.use(requireAuth);

/**
 * GET /api/messages/conversations
 * Fetch recent conversations with peer profiles and last messages.
 */
router.get('/conversations', generalApiRateLimiter, getConversations);

/**
 * GET /api/messages/:conversationId
 * Fetch paginated message history for a known conversationId ("idA_idB").
 *
 * Query: ?page=1&limit=50
 */
router.get('/:conversationId', generalApiRateLimiter, getMessages);

/**
 * GET /api/messages/conversation/:otherUserId
 * Convenience route: derive conversationId from the other user's ID.
 *
 * Query: ?page=1&limit=50
 */
router.get('/conversation/:otherUserId', generalApiRateLimiter, getMessagesByUser);

export default router;
