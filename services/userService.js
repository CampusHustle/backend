import { User } from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';

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
 * Updates profile fields for the authenticated user.
 * Supports updating skills, bio, department, hourly rate, and role switching.
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
    'hourlyRate',
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

  // Validate hourlyRate is a non-negative number if provided
  if (updates.hourlyRate !== undefined) {
    const rate = parseFloat(updates.hourlyRate);
    if (isNaN(rate) || rate < 0) {
      throw new AppError('Hourly rate must be a non-negative number.', 400, 'VALIDATION_ERROR');
    }
    updates.hourlyRate = rate;
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
