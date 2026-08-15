import { User } from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Escapes regex special characters to prevent ReDoS and regex query injection.
 * @param {string} text
 * @returns {string}
 */
function escapeRegex(text) {
  return typeof text === 'string' ? text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') : '';
}

/**
 * Retrieves the currently logged in user's profile.
 * @param {string} userId
 */
export async function getProfile(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User profile not found.', 404, 'USER_NOT_FOUND');
  }
  return user;
}

/**
 * Updates profile fields for the authenticated user.
 * Supports updating skills, bio, department, and role switching.
 * @param {string} userId
 * @param {Object} updateData
 */
export async function updateProfile(userId, updateData) {
  const allowedFields = [
    'name',
    'department',
    'year',
    'bio',
    'profilePicUrl',
    'skillsTeaching',
    'skillsLearning',
    'role'
  ];

  const updates = {};
  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      updates[field] = updateData[field];
    }
  }

  // Prevent Elevation of Privilege (STRIDE): Users cannot self-assign the 'admin' role
  if (updates.role) {
    if (!['student', 'tutor'].includes(updates.role)) {
      throw new AppError('Invalid role specified. Self-service updates are restricted to student or tutor roles.', 403, 'FORBIDDEN');
    }
  }

  const updatedUser = await User.findByIdAndUpdate(userId, updates, {
    new: true,
    runValidators: true
  });

  if (!updatedUser) {
    throw new AppError('User profile not found.', 404, 'USER_NOT_FOUND');
  }

  return updatedUser;
}

/**
 * Retrieves a public user profile by user ID.
 * @param {string} targetUserId
 */
export async function getPublicProfile(targetUserId) {
  if (typeof targetUserId !== 'string') {
    throw new AppError('Invalid user ID format.', 400, 'VALIDATION_ERROR');
  }

  const user = await User.findById(targetUserId);
  if (!user || user.isBlocked) {
    throw new AppError('Tutor or user profile not found.', 404, 'USER_NOT_FOUND');
  }
  return user;
}

/**
 * Searches and filters tutors based on subject/skill, department, name, and rating.
 * Mitigates NoSQL Injection & ReDoS by escaping regex characters and validating types.
 * @param {Object} queryParams
 */
export async function searchTutors(queryParams) {
  const { name, subject, department, minRating, role } = queryParams;

  const query = {
    isBlocked: false
  };

  // Filter by role (default to tutor or users with teaching skills)
  if (role && typeof role === 'string') {
    query.role = role;
  } else {
    query.$or = [{ role: 'tutor' }, { skillsTeaching: { $exists: true, $not: { $size: 0 } } }];
  }

  if (name && typeof name === 'string') {
    query.name = { $regex: escapeRegex(name), $options: 'i' };
  }

  if (subject && typeof subject === 'string') {
    query.skillsTeaching = { $regex: escapeRegex(subject), $options: 'i' };
  }

  if (department && typeof department === 'string') {
    query.department = { $regex: escapeRegex(department), $options: 'i' };
  }

  if (minRating) {
    const numericRating = parseFloat(minRating);
    if (!isNaN(numericRating)) {
      query['rating.knowledge'] = { $gte: numericRating };
    }
  }

  const tutors = await User.find(query).limit(50);
  return tutors;
}
