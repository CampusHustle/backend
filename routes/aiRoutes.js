import { Router } from 'express';
import multer from 'multer';
import { askQuestion } from '../controllers/aiController.js';
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

export default router;
