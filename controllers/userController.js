import * as userService from '../services/userService.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Controller to fetch authenticated user's profile.
 */
export async function getMe(req, res, next) {
  try {
    const user = await userService.getProfile(req.user._id);
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to update authenticated user's profile.
 */
export async function updateMe(req, res, next) {
  try {
    // Fail fast input validation
    if (!req.body || Object.keys(req.body).length === 0) {
      throw new AppError('No update fields provided.', 400, 'VALIDATION_ERROR');
    }

    const updatedUser = await userService.updateProfile(req.user._id, req.body);
    res.status(200).json({ user: updatedUser });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to search tutors by subject, name, department, or rating.
 */
export async function searchTutors(req, res, next) {
  try {
    const tutors = await userService.searchTutors(req.query);
    res.status(200).json({ tutors });
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
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}
