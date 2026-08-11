import * as authService from '../services/authService.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Handles student/tutor user registration.
 * Sanitizes input types to mitigate NoSQL Injection (STRIDE: Tampering / OWASP Injection).
 */
export async function register(req, res, next) {
  try {
    const { email, password, name, university, department, year, role } = req.body;

    // Fail fast input validation & strict type checking to prevent NoSQL injection objects
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof name !== 'string' ||
      typeof university !== 'string'
    ) {
      throw new AppError('Email, password, name, and university must be valid strings.', 400, 'VALIDATION_ERROR');
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

    // Fail fast input validation & strict type checking to prevent NoSQL query operator injection
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
 * Handles university email verification.
 */
export async function verifyEmail(req, res, next) {
  try {
    const { email } = req.body;

    if (typeof email !== 'string') {
      throw new AppError('Email must be a valid string.', 400, 'VALIDATION_ERROR');
    }

    const result = await authService.verifyUserEmail(email);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Refreshes an access token using a refresh token.
 */
export async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (typeof refreshToken !== 'string') {
      throw new AppError('refreshToken must be a valid string.', 400, 'VALIDATION_ERROR');
    }

    const tokens = await authService.refreshAuthToken(refreshToken);

    res.status(200).json(tokens);
  } catch (error) {
    next(error);
  }
}
