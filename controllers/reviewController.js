import * as reviewService from '../services/reviewService.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * POST /api/reviews
 * Submit a review for a completed booking.
 *
 * Body: { bookingId, rating: { knowledge, communication, punctuality }, comment? }
 */
export async function createReview(req, res, next) {
  try {
    const { bookingId, rating, comment } = req.body;

    if (!bookingId || typeof bookingId !== 'string') {
      throw new AppError('bookingId is required.', 400, 'VALIDATION_ERROR');
    }

    const review = await reviewService.submitReview(req.user._id, { bookingId, rating, comment });

    res.status(201).json({ success: true, review });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reviews/user/:userId
 * Fetch all reviews written about a specific user (public).
 *
 * Query: ?page=1&limit=20
 */
export async function getUserReviews(req, res, next) {
  try {
    const { userId } = req.params;

    if (!userId || typeof userId !== 'string') {
      throw new AppError('userId is required.', 400, 'VALIDATION_ERROR');
    }

    const result = await reviewService.getReviewsForUser(userId, req.query);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
}
