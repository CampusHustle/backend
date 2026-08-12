import rateLimit from 'express-rate-limit';

/**
 * Factory function to create custom rate limiters per route.
 * Satisfies NFR-2 (Rate-limiting scaffolding configurable per route).
 * @param {Object} options
 * @param {number} [options.windowMs=900000] - Window size in ms (default 15 mins)
 * @param {number} [options.limit=100] - Max requests per IP in window
 * @param {string} [options.message='Too many requests'] - Custom error message
 */
export function createRateLimiter({ windowMs = 15 * 60 * 1000, limit = 100, message = 'Too many requests. Please try again later.' } = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: {
        message,
        code: 'RATE_LIMIT_EXCEEDED'
      }
    }
  });
}

/**
 * Pre-configured rate limiter for authentication endpoints (login/register).
 * Mitigates DoS and brute-force credential attacks (STRIDE).
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // max 20 requests per IP per 15 minutes
  message: 'Too many authentication attempts. Please try again later.'
});

/**
 * Pre-configured rate limiter for general API endpoints.
 */
export const generalApiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  message: 'API rate limit exceeded. Please slow down your requests.'
});

/**
 * Pre-configured rate limiter for write-heavy actions (booking, note creation, messaging).
 */
export const writeActionRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 10, // max 10 write requests per minute
  message: 'Too many write actions performed in a short time.'
});
