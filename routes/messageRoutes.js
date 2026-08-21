import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { generalApiRateLimiter } from '../middleware/rateLimiter.js';
import {
  getMessages,
  getMessagesByUser,
  getConversations,
  getUnreadCount,
  markConversationAsRead,
  sendMessage
} from '../controllers/messageController.js';

const router = Router();

// All message routes require authentication
router.use(requireAuth);

/**
 * GET /api/messages/unread-count
 * Returns the unread messages count for the current user.
 */
router.get('/unread-count', generalApiRateLimiter, getUnreadCount);

/**
 * GET /api/messages/conversations
 * Fetch recent conversations with peer profiles and unread counts.
 */
router.get('/conversations', generalApiRateLimiter, getConversations);

/**
 * POST /api/messages/send
 * Sends a message with instant live socket notification delivery.
 */
router.post('/send', generalApiRateLimiter, sendMessage);

/**
 * PATCH /api/messages/:conversationId/read
 * Marks all peer messages in a conversation as read.
 */
router.patch('/:conversationId/read', generalApiRateLimiter, markConversationAsRead);

/**
 * GET /api/messages/:conversationId
 * Fetch paginated message history for a known conversationId ("idA_idB").
 */
router.get('/:conversationId', generalApiRateLimiter, getMessages);

/**
 * GET /api/messages/conversation/:otherUserId
 * Convenience route: derive conversationId from the other user's ID.
 */
router.get('/conversation/:otherUserId', generalApiRateLimiter, getMessagesByUser);

export default router;
