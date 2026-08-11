import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { config } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { isUniversityEmail } from '../utils/emailValidator.js';

/**
 * Generates an access token and refresh token for a user.
 * @param {string} userId
 * @param {string} role
 * @returns {{ accessToken: string, refreshToken: string }}
 */
function generateTokens(userId, role) {
  const accessToken = jwt.sign(
    { userId, role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  const refreshToken = jwt.sign(
    { userId },
    config.jwtRefreshSecret,
    { expiresIn: config.jwtRefreshExpiresIn }
  );

  return { accessToken, refreshToken };
}

/**
 * Registers a new student or tutor account.
 * Enforces university domain validation to prevent Spoofing (STRIDE).
 * @param {Object} userData
 */
export async function registerUser({ email, password, name, university, department, year, role }) {
  const normalizedEmail = email.trim().toLowerCase();

  // Validate university email domain requirement (FR-1, TC-1)
  if (!isUniversityEmail(normalizedEmail)) {
    throw new AppError('Registration restricted strictly to valid university email addresses ending with .edu.et', 400, 'INVALID_UNIVERSITY_EMAIL');
  }

  // Check existing account
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new AppError('An account with this email address already exists.', 409, 'EMAIL_EXISTS');
  }

  // Hash password using bcrypt (NFR-1)
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const userRole = role && ['student', 'tutor'].includes(role) ? role : 'student';

  const newUser = new User({
    name,
    email: normalizedEmail,
    passwordHash,
    role: userRole,
    university,
    department: department || '',
    year: year ? parseInt(year, 10) : 1,
    isEmailVerified: true // Auto-verify valid university email domains in MVP scope
  });

  const { accessToken, refreshToken } = generateTokens(newUser._id.toString(), newUser.role);

  // Hash refresh token before saving to database for security in depth
  newUser.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await newUser.save();

  return {
    user: newUser,
    accessToken,
    refreshToken
  };
}

/**
 * Authenticates a user and returns new auth tokens.
 * @param {Object} credentials
 */
export async function loginUser({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!isUniversityEmail(normalizedEmail)) {
    throw new AppError('Only valid university email addresses can log in.', 400, 'INVALID_UNIVERSITY_EMAIL');
  }

  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash +refreshTokenHash');
  if (!user) {
    throw new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS');
  }

  if (user.isBlocked) {
    throw new AppError('Account is blocked. Please contact support.', 403, 'ACCOUNT_BLOCKED');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS');
  }

  const { accessToken, refreshToken } = generateTokens(user._id.toString(), user.role);

  user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await user.save();

  return {
    user,
    accessToken,
    refreshToken
  };
}

/**
 * Confirms university email verification status.
 * @param {string} email
 */
export async function verifyUserEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  user.isEmailVerified = true;
  await user.save();

  return { message: 'Email address verified successfully.', isEmailVerified: true };
}

/**
 * Refreshes an expired access token using a valid refresh token.
 * Implements token rotation to mitigate token theft (STRIDE: Information Disclosure).
 * @param {string} refreshToken
 */
export async function refreshAuthToken(refreshToken) {
  if (!refreshToken) {
    throw new AppError('Refresh token required.', 400, 'TOKEN_REQUIRED');
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
  } catch (_err) {
    throw new AppError('Invalid or expired refresh token.', 401, 'INVALID_REFRESH_TOKEN');
  }

  const user = await User.findById(decoded.userId).select('+refreshTokenHash');
  if (!user || user.isBlocked) {
    throw new AppError('User access revoked.', 401, 'UNAUTHORIZED');
  }

  if (!user.refreshTokenHash) {
    throw new AppError('Refresh token invalid or already used.', 401, 'INVALID_REFRESH_TOKEN');
  }

  const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
  if (!matches) {
    throw new AppError('Refresh token mismatch.', 401, 'INVALID_REFRESH_TOKEN');
  }

  // Issue rotated token pair
  const tokens = generateTokens(user._id.toString(), user.role);
  user.refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
  await user.save();

  return tokens;
}
