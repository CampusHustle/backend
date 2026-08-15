/** Centralized Express error-handling middleware. */
export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || (statusCode === 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');

  if (statusCode === 500) {
    // Log server errors without exposing sensitive information
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.stack || err);
  }

  res.status(statusCode).json({
    error: {
      message,
      ...(code && { code })
    }
  });
}

/** Custom error helper class for HTTP operational errors. */
export class AppError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}
