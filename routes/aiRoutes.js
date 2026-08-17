import { Router } from 'express';
import { askQuestion } from '../controllers/aiController.js';
import { requireAuth } from '../middleware/auth.js';
import { generalApiRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

/**
 * POST /api/ai/ask
 * Ask the AI Study Assistant a question scoped to a tutor's uploaded study material.
 * 
 * Satisfies:
 *   - FR-11: Scoped AI Q&A assistant
 *   - TC-4: Explicit fallback for unanswerable questions
 *   - Spec Section 8.6: API Contract
 *   - NFR-2: Rate limiting on AI assistant queries
 *
 * Authentication: Required (Bearer JWT) — mitigates Elevation of Privilege
 * and Information Disclosure (STRIDE) by restricting queries to logged-in users.
 * 
 * Request Body:
 *   {
 *     "tutorId": "ObjectId (string)",
 *     "question": "string"
 *   }
 * 
 * Response (200):
 *   {
 *     "success": true,
 *     "answer": "Grounded answer from tutor notes...",
 *     "grounded": true,
 *     "sources": [
 *       { "noteId": "ObjectId", "pageNumber": 1, "chunkIndex": 0, "similarityScore": 0.82 }
 *     ],
 *     "matchedChunksCount": 1
 *   }
 */
router.post('/ask', generalApiRateLimiter, requireAuth, askQuestion);

export default router;
