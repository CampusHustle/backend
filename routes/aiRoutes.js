import { Router } from 'express';
import multer from 'multer';
import { askQuestion } from '../controllers/aiController.js';
import {
  createAiConversation,
  deleteAiConversation,
  getAiConversationMessages,
  getAiConversations
} from '../controllers/aiConversationController.js';
import { requireAuth } from '../middleware/auth.js';
import { generalApiRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit
  }
});

/**
 * POST /api/ai/ask
 * Ask the AI Study Assistant a question scoped to a tutor's uploaded study material
 * or analyze an attached PDF / Image / Text file directly with OCR and document extraction.
 */
router.post('/ask', generalApiRateLimiter, requireAuth, upload.single('file'), askQuestion);

router.get('/conversations', generalApiRateLimiter, requireAuth, getAiConversations);
router.post('/conversations', generalApiRateLimiter, requireAuth, createAiConversation);
router.get('/conversations/:conversationId/messages', generalApiRateLimiter, requireAuth, getAiConversationMessages);
router.post('/conversations/:conversationId/messages', generalApiRateLimiter, requireAuth, upload.single('file'), (req, res, next) => {
  req.body = { ...(req.body || {}), conversationId: req.params.conversationId };
  return askQuestion(req, res, next);
});
router.delete('/conversations/:conversationId', generalApiRateLimiter, requireAuth, deleteAiConversation);

export default router;
