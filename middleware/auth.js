import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { AppError } from './errorHandler.js';
import { User } from '../models/User.js';

/**
 * Express middleware to authenticate requests via Bearer JWT.
 * Mitigates Elevation of Privilege (STRIDE) by verifying identity on protected routes.
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Missing or malformed token.', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (_err) {
      throw new AppError('Invalid or expired access token.', 401, 'UNAUTHORIZED');
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new AppError('User account associated with this token no longer exists.', 401, 'UNAUTHORIZED');
    }

    if (user.isBlocked) {
      throw new AppError('Account has been suspended.', 403, 'ACCOUNT_BLOCKED');
    }

    if (!user.isEmailVerified) {
      throw new AppError(
        'Your university email is not verified. Please verify your email before accessing the platform.',
        403,
        'EMAIL_NOT_VERIFIED'
      );
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Express middleware to optionally authenticate requests via Bearer JWT.
 * Attaches req.user if a valid token is provided, but continues silently if unauthenticated or token invalid.
 */
export async function optionalAuth(req, res, _next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(decoded.userId);
      if (user && !user.isBlocked) {
        req.user = user;
      }
    }
  } catch (_err) {
    // Ignore invalid/expired tokens for optional authentication
  }
  _next();
}


/**
 * Middleware generator to enforce role-based authorization.
 * Mitigates Elevation of Privilege (STRIDE).
 * @param {...string} allowedRoles
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401, 'UNAUTHORIZED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Forbidden. Insufficient permissions for this action.', 403, 'FORBIDDEN'));
    }

    next();
  };
}

/**
 * Middleware to restrict action to accounts with verified university email addresses.
 */
export function requireVerifiedEmail(req, res, next) {
  if (!req.user) {
    return next(new AppError('Authentication required.', 401, 'UNAUTHORIZED'));
  }

  if (!req.user.isEmailVerified) {
    return next(new AppError('University email verification required for this action.', 403, 'EMAIL_NOT_VERIFIED'));
  }

  next();
}
