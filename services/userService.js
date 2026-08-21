import { Types } from 'mongoose';
import { User } from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';
import { ALLOWED_SKILL_TAGS, validateSkillTags } from '../utils/skillTags.js';

/**
 * Escapes regex special characters to prevent ReDoS and regex query injection.
 * @param {string} text
 * @returns {string}
 */
export function escapeRegex(text) {
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
 * Updates profile fields for the authenticated user (FR-2, FR-3).
 * Enforces structured skill tags, input validation, and role-switch guards.
 * @param {string} userId
 * @param {Object} updateData
 */
export async function updateProfile(userId, updateData) {
  const updates = {};

  // ── Name ──────────────────────────────────────────────────────────────────
  if (updateData.name !== undefined) {
    if (typeof updateData.name !== 'string' || !updateData.name.trim()) {
      throw new AppError('Name must be a non-empty string.', 400, 'VALIDATION_ERROR');
    }
    updates.name = updateData.name.trim();
  }

  // ── Bio ───────────────────────────────────────────────────────────────────
  if (updateData.bio !== undefined) {
    if (typeof updateData.bio !== 'string') {
      throw new AppError('Bio must be a string.', 400, 'VALIDATION_ERROR');
    }
    if (updateData.bio.length > 500) {
      throw new AppError('Bio cannot exceed 500 characters.', 400, 'VALIDATION_ERROR');
    }
    updates.bio = updateData.bio.trim();
  }

  // ── University ───────────────────────────────────────────────────────────
  if (updateData.university !== undefined && typeof updateData.university === 'string' && updateData.university.trim()) {
    updates.university = updateData.university.trim();
  }

  // ── Department ────────────────────────────────────────────────────────────
  if (updateData.department !== undefined) {
    if (typeof updateData.department !== 'string') {
      throw new AppError('Department must be a string.', 400, 'VALIDATION_ERROR');
    }
    updates.department = updateData.department.trim();
  }

  // ── Gender ────────────────────────────────────────────────────────────────
  if (updateData.gender !== undefined) {
    if (updateData.gender === null || updateData.gender === '') {
      updates.gender = null;
    } else if (typeof updateData.gender === 'string') {
      const normalizedGender = updateData.gender.trim().toLowerCase();
      if (!['male', 'female'].includes(normalizedGender)) {
        throw new AppError('Gender must be either male or female.', 400, 'VALIDATION_ERROR');
      }
      updates.gender = normalizedGender;
    } else {
      throw new AppError('Gender must be a string (male or female).', 400, 'VALIDATION_ERROR');
    }
  }

  // ── Year ──────────────────────────────────────────────────────────────────
  if (updateData.year !== undefined) {
    const yearMap = {
      freshman: 1,
      sophomore: 2,
      junior: 3,
      senior: 4,
      '5th year': 5,
      grad: 5,
      graduate: 5,
      postgrad: 6,
    };
    let parsedYear = typeof updateData.year === 'string' && yearMap[updateData.year.toLowerCase()]
      ? yearMap[updateData.year.toLowerCase()]
      : parseInt(updateData.year, 10);

    if (isNaN(parsedYear) || parsedYear < 1 || parsedYear > 6) {
      throw new AppError('Year must be a number between 1 and 6 or valid class standing.', 400, 'VALIDATION_ERROR');
    }
    updates.year = parsedYear;
  }

  // ── Hourly Rate ───────────────────────────────────────────────────────────
  if (updateData.hourlyRate !== undefined) {
    const rate = parseFloat(updateData.hourlyRate);
    if (isNaN(rate) || rate < 0) {
      throw new AppError('Hourly rate must be a non-negative number.', 400, 'VALIDATION_ERROR');
    }
    if (rate > 10000) {
      throw new AppError('Hourly rate cannot exceed 10,000.', 400, 'VALIDATION_ERROR');
    }
    updates.hourlyRate = rate;
  }

  // ── Profile Picture URL ───────────────────────────────────────────────────
  if (updateData.profilePicUrl !== undefined) {
    if (typeof updateData.profilePicUrl !== 'string') {
      throw new AppError('profilePicUrl must be a string.', 400, 'VALIDATION_ERROR');
    }
    const trimmed = updateData.profilePicUrl.trim();
    if (trimmed && !/^https?:\/\/.+/.test(trimmed) && !trimmed.startsWith('data:image/')) {
      throw new AppError('profilePicUrl must be a valid http/https URL or image data.', 400, 'VALIDATION_ERROR');
    }
    updates.profilePicUrl = trimmed;
  }

  // ── Availability ──────────────────────────────────────────────────────────
  if (updateData.availability !== undefined) {
    if (Array.isArray(updateData.availability)) {
      updates.availability = updateData.availability.filter((a) => typeof a === 'string');
    }
  }

  // ── Profile Complete Flag ─────────────────────────────────────────────────
  if (updateData.isProfileComplete !== undefined) {
    updates.isProfileComplete = Boolean(updateData.isProfileComplete);
  }

  // ── Skill Tags (FR-3) ─────────────────────────────────────────────────────
  if (updateData.skillsTeaching !== undefined) {
    updates.skillsTeaching = validateSkillTags(updateData.skillsTeaching, 'skillsTeaching', AppError);
  }

  if (updateData.skillsLearning !== undefined) {
    updates.skillsLearning = validateSkillTags(updateData.skillsLearning, 'skillsLearning', AppError);
  }

  // ── Role Switch (student ↔ tutor only — STRIDE: Elevation of Privilege) ───
  if (updateData.role !== undefined) {
    if (!['student', 'tutor'].includes(updateData.role)) {
      throw new AppError(
        'Invalid role. You may only switch between student and tutor.',
        403,
        'FORBIDDEN'
      );
    }
    updates.role = updateData.role;
  }

  // Guard: nothing valid to update
  if (Object.keys(updates).length === 0) {
    throw new AppError('No valid updatable fields provided.', 400, 'VALIDATION_ERROR');
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
  if (typeof targetUserId !== 'string' || !targetUserId.trim()) {
    throw new AppError('Invalid user ID format.', 400, 'VALIDATION_ERROR');
  }

  let user = null;
  if (Types.ObjectId.isValid(targetUserId)) {
    user = await User.findById(targetUserId);
  }

  if (!user || user.isBlocked) {
    throw new AppError('Tutor or user profile not found.', 404, 'USER_NOT_FOUND');
  }
  return user;
}

/**
 * Searches and filters tutors based on subject/skill, department, price range, name, and rating.
 * Satisfies FR-4 & NFR-4.
 * Mitigates NoSQL Injection & ReDoS by escaping regex characters and validating numeric ranges.
 *
 * @param {Object} queryParams
 * @param {string} [queryParams.subject] - Subject or skill tag to filter by
 * @param {string} [queryParams.department] - Academic department
 * @param {string|number} [queryParams.minPrice] - Minimum hourly rate
 * @param {string|number} [queryParams.maxPrice] - Maximum hourly rate
 * @param {string|number} [queryParams.minRating] - Minimum knowledge/overall rating
 * @param {string} [queryParams.name] - Tutor name search
 * @param {string} [queryParams.sortBy] - Sort order: 'price_asc', 'price_desc', 'rating', 'newest'
 * @param {string|number} [queryParams.page=1] - Page number
 * @param {string|number} [queryParams.limit=20] - Number of results per page
 * @returns {Promise<{ tutors: Array, total: number, page: number, totalPages: number }>}
 */
export async function searchTutors(queryParams = {}) {
  const {
    name,
    subject,
    department,
    minPrice,
    maxPrice,
    minRating,
    role,
    sortBy = 'rating',
    page = 1,
    limit = 20
  } = queryParams;

  const query = {
    isBlocked: false
  };

  // Filter by role (default to tutor or users with active teaching skills)
  if (role && typeof role === 'string') {
    query.role = role;
  } else {
    query.$or = [
      { role: 'tutor' },
      { skillsTeaching: { $exists: true, $not: { $size: 0 } } }
    ];
  }

  // General search query matching across name, department, bio, and subjects
  const generalQuery = queryParams.q || queryParams.query;
  if (generalQuery && typeof generalQuery === 'string' && generalQuery.trim()) {
    const escaped = escapeRegex(generalQuery.trim());
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { name: { $regex: escaped, $options: 'i' } },
        { department: { $regex: escaped, $options: 'i' } },
        { skillsTeaching: { $regex: escaped, $options: 'i' } },
        { bio: { $regex: escaped, $options: 'i' } }
      ]
    });
  }

  // Subject / Skill filter (exact tag or case-insensitive partial match)
  if (subject && typeof subject === 'string' && subject.trim()) {
    query.skillsTeaching = { $regex: escapeRegex(subject.trim()), $options: 'i' };
  }

  // Name filter
  if (name && typeof name === 'string' && name.trim()) {
    query.name = { $regex: escapeRegex(name.trim()), $options: 'i' };
  }

  // Department filter
  if (department && typeof department === 'string' && department.trim()) {
    query.department = { $regex: escapeRegex(department.trim()), $options: 'i' };
  }

  // Price range filter (hourlyRate)
  const priceFilter = {};
  if (minPrice !== undefined && minPrice !== '') {
    const parsedMin = parseFloat(minPrice);
    if (!isNaN(parsedMin) && parsedMin >= 0) {
      priceFilter.$gte = parsedMin;
    }
  }
  if (maxPrice !== undefined && maxPrice !== '') {
    const parsedMax = parseFloat(maxPrice);
    if (!isNaN(parsedMax) && parsedMax >= 0) {
      priceFilter.$lte = parsedMax;
    }
  }
  if (Object.keys(priceFilter).length > 0) {
    query.hourlyRate = priceFilter;
  }

  // Minimum rating filter
  if (minRating !== undefined && minRating !== '') {
    const numericRating = parseFloat(minRating);
    if (!isNaN(numericRating) && numericRating >= 0) {
      query['rating.knowledge'] = { $gte: numericRating };
    }
  }

  // Determine sorting criteria
  let sortCriteria = { 'rating.knowledge': -1, createdAt: -1 };
  if (sortBy === 'price_asc') {
    sortCriteria = { hourlyRate: 1, 'rating.knowledge': -1 };
  } else if (sortBy === 'price_desc') {
    sortCriteria = { hourlyRate: -1, 'rating.knowledge': -1 };
  } else if (sortBy === 'newest') {
    sortCriteria = { createdAt: -1 };
  } else if (sortBy === 'rating') {
    sortCriteria = { 'rating.knowledge': -1, 'rating.count': -1 };
  }

  // Pagination parameters with safe bounds
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const [tutors, total] = await Promise.all([
    User.find(query)
      .sort(sortCriteria)
      .skip(skip)
      .limit(parsedLimit)
      .lean(),
    User.countDocuments(query)
  ]);

  return {
    tutors,
    total,
    page: parsedPage,
    totalPages: Math.ceil(total / parsedLimit) || 0
  };
}

/**
 * Blocks another user (FR-13).
 * Adds target user to current user's blockedUsers list.
 *
 * @param {string} userId - Current user ID
 * @param {string} targetUserId - Target user to block
 */
export async function blockUser(userId, targetUserId) {
  if (!targetUserId || typeof targetUserId !== 'string') {
    throw new AppError('targetUserId is required.', 400, 'VALIDATION_ERROR');
  }

  const userStr = userId.toString();
  if (userStr === targetUserId) {
    throw new AppError('You cannot block yourself.', 400, 'VALIDATION_ERROR');
  }

  const target = await User.findById(targetUserId);
  if (!target) {
    throw new AppError('User to block not found.', 404, 'USER_NOT_FOUND');
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $addToSet: { blockedUsers: targetUserId } },
    { new: true }
  );

  return { message: 'User blocked successfully.', blockedUsers: user.blockedUsers };
}

/**
 * Unblocks a previously blocked user (FR-13).
 *
 * @param {string} userId - Current user ID
 * @param {string} targetUserId - Target user to unblock
 */
export async function unblockUser(userId, targetUserId) {
  if (!targetUserId || typeof targetUserId !== 'string') {
    throw new AppError('targetUserId is required.', 400, 'VALIDATION_ERROR');
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $pull: { blockedUsers: targetUserId } },
    { new: true }
  );

  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  return { message: 'User unblocked successfully.', blockedUsers: user.blockedUsers };
}

/**
 * Admin action to toggle account suspension (FR-13, NFR-9).
 *
 * @param {string} targetUserId
 * @param {boolean} isBlocked
 */
export async function adminSetUserBlock(targetUserId, isBlocked) {
  if (typeof isBlocked !== 'boolean') {
    throw new AppError('isBlocked must be a boolean.', 400, 'VALIDATION_ERROR');
  }

  const update = { isBlocked };
  if (isBlocked) {
    update.refreshTokenHash = null; // Invalidate active sessions immediately
  }

  const user = await User.findByIdAndUpdate(targetUserId, update, { new: true });
  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  return {
    message: isBlocked ? 'User account suspended.' : 'User account suspension lifted.',
    user
  };
}

