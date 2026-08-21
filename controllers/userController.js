import * as userService from '../services/userService.js';
import { AppError } from '../middleware/errorHandler.js';
import { ALLOWED_SKILL_TAGS } from '../utils/skillTags.js';

/**
 * Controller to fetch authenticated user's profile.
 */
export async function getMe(req, res, next) {
  try {
    const user = await userService.getProfile(req.user._id);
    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
}

/**
 * Returns the canonical list of allowed skill tags (FR-3).
 * Frontend uses this to render tag pickers without hardcoding the list.
 */
export async function getSkillTags(_req, res) {
  res.status(200).json({ success: true, tags: ALLOWED_SKILL_TAGS });
}

/**
 * Controller to update authenticated user's profile.
 */
export async function updateMe(req, res, next) {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      throw new AppError('No update fields provided.', 400, 'VALIDATION_ERROR');
    }

    const updatedUser = await userService.updateProfile(req.user._id, req.body);
    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to search tutors by subject, price, rating, department, or name.
 * Satisfies FR-4.
 */
export async function searchTutors(req, res, next) {
  try {
    const currentUserId = req.user?._id || req.query.excludeUserId;
    const result = await userService.searchTutors(req.query, currentUserId);
    res.status(200).json({
      success: true,
      count: result.tutors.length,
      tutors: result.tutors,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to fetch public user/tutor profile by ID.
 */
export async function getUserById(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) {
      throw new AppError('User ID parameter is required.', 400, 'VALIDATION_ERROR');
    }

    const user = await userService.getPublicProfile(id);
    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/users/block/:id
 * Block another user (FR-13).
 */
export async function blockUser(req, res, next) {
  try {
    const { id } = req.params;
    const result = await userService.blockUser(req.user._id, id);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/users/block/:id
 * Unblock a user (FR-13).
 */
export async function unblockUser(req, res, next) {
  try {
    const { id } = req.params;
    const result = await userService.unblockUser(req.user._id, id);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/users/:id/status
 * Admin: toggle isBlocked account suspension (FR-13, NFR-9).
 */
export async function adminSetUserStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { isBlocked } = req.body;

    if (typeof isBlocked !== 'boolean') {
      throw new AppError('isBlocked boolean is required.', 400, 'VALIDATION_ERROR');
    }

    const result = await userService.adminSetUserBlock(id, isBlocked);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

