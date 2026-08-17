import test from 'node:test';
import assert from 'node:assert/strict';

// ─── Review Model and Service Tests (FR-12) ──────────────────────────────────

test('Review Model - schema definitions and validation exports', async () => {
  const { Review } = await import('../models/Review.js');
  assert.equal(typeof Review, 'function');
  assert.equal(Review.modelName, 'Review');

  const paths = Review.schema.paths;
  assert.ok(paths.reviewerId, 'reviewerId path missing');
  assert.ok(paths.revieweeId, 'revieweeId path missing');
  assert.ok(paths.bookingId, 'bookingId path missing');
  assert.ok(paths['rating.knowledge'], 'rating.knowledge path missing');
  assert.ok(paths['rating.communication'], 'rating.communication path missing');
  assert.ok(paths['rating.punctuality'], 'rating.punctuality path missing');
  assert.ok(paths.comment, 'comment path missing');
});

test('Review Service - exported functions check', async () => {
  const reviewService = await import('../services/reviewService.js');
  assert.equal(typeof reviewService.submitReview, 'function');
  assert.equal(typeof reviewService.getReviewsForUser, 'function');
});

test('Review Controller - exported functions check', async () => {
  const reviewController = await import('../controllers/reviewController.js');
  assert.equal(typeof reviewController.createReview, 'function');
  assert.equal(typeof reviewController.getUserReviews, 'function');
});

test('Review Routes - router module exports router instance', async () => {
  const reviewRoutes = await import('../routes/reviewRoutes.js');
  assert.ok(reviewRoutes.default, 'Default export for review routes missing');
});
