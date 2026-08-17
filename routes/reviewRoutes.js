import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { writeActionRateLimiter, generalApiRateLimiter } from '../middleware/rateLimiter.js';
import { createReview, getUserReviews } from '../controllers/reviewController.js';

const router = Router();

/**
 * POST /api/reviews
 * Submit a review for a completed booking.
 * Auth required. One review per booking.
 *
 * Body:
 *   {
 *     "bookingId": "<id>",
 *     "rating": { "knowledge": 4, "communication": 5, "punctuality": 4 },
 *     "comment": "Great tutor!"
 *   }
 *
 * Errors:
 *   400 BOOKING_NOT_COMPLETED - booking is not completed yet
 *   403 FORBIDDEN             - caller is not a participant
 *   409 REVIEW_ALREADY_EXISTS - review already submitted for this booking
 */
router.post('/', writeActionRateLimiter, requireAuth, createReview);

/**
 * GET /api/reviews/user/:userId
 * Fetch all reviews for a user (public — displayed on tutor profile).
 * Query: ?page=1&limit=20
 */
router.get('/user/:userId', generalApiRateLimiter, getUserReviews);

export default router;
