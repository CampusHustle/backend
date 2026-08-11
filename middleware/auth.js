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

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
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
