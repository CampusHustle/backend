import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { config } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { isUniversityEmail } from '../utils/emailValidator.js';
import { sendVerificationEmail } from './emailService.js';

/**
 * Generates an access token and refresh token pair for a user.
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
 * Generates a signed verification token for university email confirmation.
 * @param {string} userId
 * @param {string} email
 * @returns {string}
 */
function generateVerificationToken(userId, email) {
  return jwt.sign(
    { userId, email, type: 'email_verification' },
    config.emailVerificationSecret,
    { expiresIn: config.emailVerificationExpiresIn }
  );
}

/**
 * Registers a new student or tutor account.
 * Generates email verification token and enforces university domain validation (FR-1, NFR-1).
 * @param {Object} userData
 */
export async function registerUser({ email, password, name, university, department, year, role }) {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = typeof name === 'string' ? name.trim() : '';

  // Validate university email domain requirement (FR-1)
  if (!isUniversityEmail(normalizedEmail)) {
    throw new AppError('Registration restricted strictly to valid university email addresses ending with .edu.et', 400, 'INVALID_UNIVERSITY_EMAIL');
  }

  // Validate name is non-empty
  if (!trimmedName) {
    throw new AppError('Name is required and cannot be blank.', 400, 'VALIDATION_ERROR');
  }

  // Validate year is within an acceptable academic range
  const parsedYear = year ? parseInt(year, 10) : 1;
  if (isNaN(parsedYear) || parsedYear < 1 || parsedYear > 6) {
    throw new AppError('Year must be a number between 1 and 6.', 400, 'VALIDATION_ERROR');
  }

  // Prevent admin role self-assignment at registration
  const userRole = role && ['student', 'tutor'].includes(role) ? role : 'student';

  // Check existing account — after validation to avoid leaking email existence on invalid inputs
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new AppError('An account with this email address already exists.', 409, 'EMAIL_EXISTS');
  }

  // Hash password using bcrypt (NFR-1)
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const newUser = new User({
    name: trimmedName,
    email: normalizedEmail,
    passwordHash,
    role: userRole,
    university: university.trim(),
    department: department ? department.trim() : '',
    year: parsedYear,
    isEmailVerified: false // Requires email verification flow
  });

  // Generate email verification token
  const verificationToken = generateVerificationToken(newUser._id.toString(), newUser.email);
  newUser.emailVerificationTokenHash = await bcrypt.hash(verificationToken, 10);
  newUser.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Issue initial authentication token pair
  const { accessToken, refreshToken } = generateTokens(newUser._id.toString(), newUser.role);
  newUser.refreshTokenHash = await bcrypt.hash(refreshToken, 10);

  await newUser.save();

  // Send verification email (non-blocking in dev; real SMTP in prod via emailService)
  await sendVerificationEmail(newUser.email, verificationToken);

  return {
    user: newUser,
    accessToken,
    refreshToken,
    // verificationToken returned for dev convenience — remove or gate on NODE_ENV in prod
    ...(process.env.NODE_ENV !== 'production' && { verificationToken })
  };
}

/**
 * Authenticates a user with university credentials.
 * @param {Object} credentials
 */
export async function loginUser({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!isUniversityEmail(normalizedEmail)) {
    throw new AppError('Only valid university email addresses ending in .edu.et can log in.', 400, 'INVALID_UNIVERSITY_EMAIL');
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

  // Issue rotated token pair
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
 * Verifies user email address using signed verification token.
 * @param {string} token
 */
export async function verifyUserEmail(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, config.emailVerificationSecret);
  } catch (_err) {
    throw new AppError('Invalid or expired email verification token.', 400, 'INVALID_VERIFICATION_TOKEN');
  }

  if (decoded.type !== 'email_verification') {
    throw new AppError('Invalid verification token type.', 400, 'INVALID_VERIFICATION_TOKEN');
  }

  const user = await User.findById(decoded.userId).select('+emailVerificationTokenHash');
  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  if (user.isEmailVerified) {
    return { message: 'Email address is already verified.', isEmailVerified: true };
  }

  if (!user.emailVerificationTokenHash) {
    throw new AppError('Verification token has already been used or invalidated.', 400, 'INVALID_VERIFICATION_TOKEN');
  }

  const matches = await bcrypt.compare(token, user.emailVerificationTokenHash);
  if (!matches) {
    throw new AppError('Verification token mismatch.', 400, 'INVALID_VERIFICATION_TOKEN');
  }

  user.isEmailVerified = true;
  user.emailVerificationTokenHash = null;
  user.emailVerificationExpires = null;
  await user.save();

  return { message: 'University email address verified successfully.', isEmailVerified: true };
}

/**
 * Resends a verification token to unverified users.
 * @param {string} email
 */
export async function resendVerificationEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();

  // Guard against non-university emails being used to probe the system (STRIDE: Spoofing)
  if (!isUniversityEmail(normalizedEmail)) {
    throw new AppError('Only valid university email addresses ending in .edu.et are accepted.', 400, 'INVALID_UNIVERSITY_EMAIL');
  }

  const user = await User.findOne({ email: normalizedEmail }).select('+emailVerificationTokenHash');

  if (!user) {
    throw new AppError('User account not found.', 404, 'USER_NOT_FOUND');
  }

  if (user.isEmailVerified) {
    throw new AppError('Email address is already verified.', 400, 'ALREADY_VERIFIED');
  }

  const verificationToken = generateVerificationToken(user._id.toString(), user.email);
  user.emailVerificationTokenHash = await bcrypt.hash(verificationToken, 10);
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  // Resend verification email
  await sendVerificationEmail(user.email, verificationToken);

  return {
    message: 'Verification email resent successfully.',
    ...(process.env.NODE_ENV !== 'production' && { verificationToken })
  };
}

/**
 * Refreshes an expired access token using a valid refresh token.
 * Implements strict Token Rotation (NFR-1 / STRIDE: Information Disclosure & Theft mitigation).
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
    throw new AppError('Session invalidated or logged out.', 401, 'INVALID_REFRESH_TOKEN');
  }

  const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
  if (!matches) {
    // If token mismatch detected, revoke user's refresh token hash as security countermeasure
    user.refreshTokenHash = null;
    await user.save();
    throw new AppError('Refresh token reuse or mismatch detected. Session revoked.', 401, 'TOKEN_REUSE_DETECTED');
  }

  // Token Rotation: Generate a completely NEW access token and NEW refresh token
  const tokens = generateTokens(user._id.toString(), user.role);

  // Invalidate old refresh token by storing hash of new refresh token
  user.refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
  await user.save();

  return tokens;
}

/**
 * Revokes refresh token session on user logout.
 * @param {string} userId
 */
export async function logoutUser(userId) {
  const user = await User.findById(userId).select('+refreshTokenHash');
  if (user) {
    user.refreshTokenHash = null;
    await user.save();
  }
  return { message: 'Logged out successfully.' };
}
