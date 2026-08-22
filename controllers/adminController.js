import * as adminService from '../services/adminService.js';
import { AppError } from '../middleware/errorHandler.js';

export async function getStats(_req, res, next) {
  try {
    const stats = await adminService.getAdminStats();
    res.status(200).json({ success: true, stats });
  } catch (error) {
    next(error);
  }
}

export async function getUsers(req, res, next) {
  try {
    const result = await adminService.listUsers(req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getUserActivity(req, res, next) {
  try {
    const activity = await adminService.getUserActivity(req.params.id);
    res.status(200).json({ success: true, activity });
  } catch (error) {
    next(error);
  }
}

export async function updateUserRole(req, res, next) {
  try {
    const { role } = req.body;
    if (!role) {
      throw new AppError('role is required.', 400, 'VALIDATION_ERROR');
    }

    const user = await adminService.updateUserRole(req.user._id, req.params.id, role);
    res.status(200).json({ success: true, message: 'User role updated successfully.', user });
  } catch (error) {
    next(error);
  }
}

export async function banUser(req, res, next) {
  try {
    const user = await adminService.banUser(req.user._id, req.params.id, req.body);
    res.status(200).json({ success: true, message: 'User banned successfully.', user });
  } catch (error) {
    next(error);
  }
}

export async function setUserStatus(req, res, next) {
  try {
    const { isBlocked, reason } = req.body;
    const user = await adminService.setUserBlocked(req.user._id, req.params.id, isBlocked, reason);
    res.status(200).json({
      success: true,
      message: isBlocked ? 'User account suspended.' : 'User account suspension lifted.',
      user
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const result = await adminService.deleteUserAccount(req.user._id, req.params.id, {
      force: req.body?.force === true || req.query.force === 'true',
      reason: req.body?.reason || ''
    });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getDeletionRequests(req, res, next) {
  try {
    const result = await adminService.listDeletionRequests(req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function approveDeletionRequest(req, res, next) {
  try {
    const result = await adminService.approveDeletionRequest(req.user._id, req.params.id, {
      force: req.body?.force === true || req.query.force === 'true',
      reason: req.body?.reason || 'Deletion request approved by administrator.'
    });
    res.status(200).json({ success: true, message: 'Deletion request approved.', ...result });
  } catch (error) {
    next(error);
  }
}

export async function rejectDeletionRequest(req, res, next) {
  try {
    const { reason } = req.body;
    const user = await adminService.rejectDeletionRequest(req.user._id, req.params.id, reason);
    res.status(200).json({ success: true, message: 'Deletion request rejected.', user });
  } catch (error) {
    next(error);
  }
}
