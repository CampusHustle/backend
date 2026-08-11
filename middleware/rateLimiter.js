import rateLimit from 'express-rate-limit';

/**
 * Rate limiter middleware for authentication write routes.
 * Mitigates Denial of Service (STRIDE) and brute-force credential attacks.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // max 20 login/register requests per IP window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many authentication attempts. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  }
});
