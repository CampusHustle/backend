import * as userService from '../services/userService.js';
import { AppError } from '../middleware/errorHandler.js';
import { ALLOWED_SKILL_TAGS } from '../utils/skillTags.js';
import { Booking } from '../models/Booking.js';

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
    const result = await userService.searchTutors(req.query);
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

/**
 * PATCH /api/users/me/role
 * Flexible dual-capability role switching (student <-> tutor).
 */
export async function updateUserRole(req, res, next) {
  try {
    const { role } = req.body;
    if (!role || !['student', 'tutor'].includes(role)) {
      throw new AppError("Role must be 'student' or 'tutor'.", 400, 'VALIDATION_ERROR');
    }

    const userId = req.user._id;

    if (role === 'student' && req.user.role === 'tutor') {
      // Check for active confirmed bookings as a tutor
      const activeBookings = await Booking.find({
        tutorId: userId,
        status: 'confirmed',
      }).populate('studentId', 'name email');

      if (activeBookings.length > 0) {
        return res.status(409).json({
          success: false,
          code: 'ACTIVE_BOOKINGS_EXIST',
          message: 'Cannot switch to student while you have active confirmed sessions.',
          blockingBookings: activeBookings,
        });
      }

      // Auto-decline pending bookings where user is tutor
      const pendingResult = await Booking.updateMany(
        { tutorId: userId, status: 'pending' },
        { $set: { status: 'declined' } }
      );

      req.user.role = 'student';
      await req.user.save();

      return res.status(200).json({
        success: true,
        message: 'Successfully switched role to student.',
        user: req.user,
        autoCancelledPendingCount: pendingResult.modifiedCount || 0,
      });
    }

    // Student -> Tutor or setting role to tutor
    req.user.role = role;
    await req.user.save();

    return res.status(200).json({
      success: true,
      message: `Successfully updated role to ${role}.`,
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
}

