import * as authService from '../services/authService.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Handles student/tutor user registration.
 * Sanitizes input types to mitigate NoSQL Injection (STRIDE: Tampering / OWASP Injection).
 */
export async function register(req, res, next) {
  try {
    const { email, password, name, university, department, year, role } = req.body;
    const isAdminSignup = role === 'admin';

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof name !== 'string' ||
      (!isAdminSignup && typeof university !== 'string')
    ) {
      throw new AppError('Email, password, name, and university must be valid strings.', 400, 'VALIDATION_ERROR');
    }

    if (!isAdminSignup && !university.trim()) {
      throw new AppError('University name is required and cannot be blank.', 400, 'VALIDATION_ERROR');
    }

    if (password.length < 6) {
      throw new AppError('Password must be at least 6 characters long.', 400, 'WEAK_PASSWORD');
    }

    const result = await authService.registerUser({ email, password, name, university, department, year, role });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles user login with university credentials.
 * Sanitizes input types to mitigate NoSQL Injection (STRIDE: Tampering / OWASP Injection).
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new AppError('Email and password must be valid strings.', 400, 'VALIDATION_ERROR');
    }

    const result = await authService.loginUser({ email, password });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles university email verification via signed verification token.
 */
export async function verifyEmail(req, res, next) {
  try {
    const token = req.body?.token || req.query?.token;

    if (typeof token !== 'string' || !token) {
      throw new AppError('Verification token string is required.', 400, 'VALIDATION_ERROR');
    }

    const result = await authService.verifyUserEmail(token);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles resending verification token to unverified university accounts.
 */
export async function resendVerification(req, res, next) {
  try {
    const { email } = req.body;

    if (typeof email !== 'string' || !email) {
      throw new AppError('Valid university email is required.', 400, 'VALIDATION_ERROR');
    }

    const result = await authService.resendVerificationEmail(email);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Refreshes an access token and rotates the refresh token.
 */
export async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (typeof refreshToken !== 'string' || !refreshToken) {
      throw new AppError('refreshToken string is required.', 400, 'VALIDATION_ERROR');
    }

    const tokens = await authService.refreshAuthToken(refreshToken);

    res.status(200).json(tokens);
  } catch (error) {
    next(error);
  }
}

/**
 * Logs out user and revokes active refresh token session.
 */
export async function logout(req, res, next) {
  try {
    const result = await authService.logoutUser(req.user._id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
