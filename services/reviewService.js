import { Review } from '../models/Review.js';
import { Booking } from '../models/Booking.js';
import { User } from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Validates that a rating value is an integer between 1 and 5.
 * @param {any} value
 * @param {string} fieldName
 */
function validateRatingField(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5 || !Number.isInteger(parsed)) {
    throw new AppError(`${fieldName} must be a whole number between 1 and 5.`, 400, 'VALIDATION_ERROR');
  }
  return parsed;
}

/**
 * Recalculates and updates the rating aggregates on the reviewee's User document.
 * Called after every new review is submitted.
 *
 * Uses MongoDB aggregation for accuracy — avoids floating-point drift from
 * incremental updates.
 *
 * @param {string} revieweeId
 */
async function recalculateUserRating(revieweeId) {
  const [agg] = await Review.aggregate([
    { $match: { revieweeId: revieweeId } },
    {
      $group: {
        _id: '$revieweeId',
        avgKnowledge: { $avg: '$rating.knowledge' },
        avgCommunication: { $avg: '$rating.communication' },
        avgPunctuality: { $avg: '$rating.punctuality' },
        count: { $sum: 1 }
      }
    }
  ]);

  if (!agg) return;

  await User.findByIdAndUpdate(revieweeId, {
    'rating.knowledge': Math.round(agg.avgKnowledge * 10) / 10,
    'rating.communication': Math.round(agg.avgCommunication * 10) / 10,
    'rating.punctuality': Math.round(agg.avgPunctuality * 10) / 10,
    'rating.count': agg.count
  });
}

/**
 * Submits a review for a completed booking (FR-12).
 * Rules:
 *   - Booking must be 'completed'
 *   - Reviewer must be a participant (student or tutor) of the booking
 *   - One review per booking (enforced by unique index + explicit check for clear error)
 *   - Reviewer cannot review themselves
 *
 * @param {string} reviewerId - Authenticated user's ID
 * @param {Object} data - { bookingId, rating: { knowledge, communication, punctuality }, comment }
 */
export async function submitReview(reviewerId, { bookingId, rating, comment }) {
  // Validate booking exists and is completed
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
  }
  if (booking.status !== 'completed') {
    throw new AppError(
      'Reviews can only be submitted for completed bookings.',
      400,
      'BOOKING_NOT_COMPLETED'
    );
  }

  const studentId = booking.studentId.toString();
  const tutorId = booking.tutorId.toString();
  const reviewerStr = reviewerId.toString();

  // Only booking participants can review
  if (reviewerStr !== studentId && reviewerStr !== tutorId) {
    throw new AppError('You are not a participant in this booking.', 403, 'FORBIDDEN');
  }

  // Determine who is being reviewed
  const revieweeId = reviewerStr === studentId ? tutorId : studentId;

  // Prevent self-review (edge case guard)
  if (reviewerStr === revieweeId) {
    throw new AppError('You cannot review yourself.', 400, 'VALIDATION_ERROR');
  }

  // Validate rating fields
  if (!rating || typeof rating !== 'object') {
    throw new AppError('rating object with knowledge, communication, and punctuality is required.', 400, 'VALIDATION_ERROR');
  }

  const knowledge = validateRatingField(rating.knowledge, 'rating.knowledge');
  const communication = validateRatingField(rating.communication, 'rating.communication');
  const punctuality = validateRatingField(rating.punctuality, 'rating.punctuality');

  // Validate optional comment
  if (comment !== undefined && typeof comment !== 'string') {
    throw new AppError('comment must be a string.', 400, 'VALIDATION_ERROR');
  }
  if (comment && comment.length > 500) {
    throw new AppError('comment cannot exceed 500 characters.', 400, 'VALIDATION_ERROR');
  }

  // Check if a review for this booking already exists (clear error before hitting unique index)
  const existing = await Review.findOne({ bookingId });
  if (existing) {
    throw new AppError('A review for this booking has already been submitted.', 409, 'REVIEW_ALREADY_EXISTS');
  }

  // Create the review
  const review = await Review.create({
    reviewerId,
    revieweeId,
    bookingId,
    rating: { knowledge, communication, punctuality },
    comment: comment ? comment.trim() : ''
  });

  // Recalculate and persist the reviewee's aggregated rating on their User doc
  await recalculateUserRating(revieweeId);

  return review;
}

/**
 * Retrieves all reviews for a given user, newest first with pagination.
 * @param {string} userId - The user whose reviews to fetch
 * @param {Object} queryParams - { page, limit }
 */
export async function getReviewsForUser(userId, { page = 1, limit = 20 } = {}) {
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const [reviews, total] = await Promise.all([
    Review.find({ revieweeId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .populate('reviewerId', 'name profilePicUrl')
      .lean(),
    Review.countDocuments({ revieweeId: userId })
  ]);

  return {
    reviews,
    total,
    page: parsedPage,
    totalPages: Math.ceil(total / parsedLimit) || 0
  };
}
