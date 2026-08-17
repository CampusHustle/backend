import * as notificationService from '../services/notificationService.js';

/**
 * @desc Get user notifications
 * @route GET /api/notifications
 * @access Private
 */
export async function getNotifications(req, res, next) {
  try {
    const userId = req.user._id;
    const { page, limit, unreadOnly } = req.query;

    const result = await notificationService.getUserNotifications(userId, {
      page,
      limit,
      unreadOnly: unreadOnly === 'true' || unreadOnly === true
    });

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc Get count of unread notifications
 * @route GET /api/notifications/unread-count
 * @access Private
 */
export async function getUnreadNotificationCount(req, res, next) {
  try {
    const userId = req.user._id;
    const result = await notificationService.getUnreadCount(userId);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc Mark a notification as read
 * @route PATCH /api/notifications/:id/read
 * @access Private
 */
export async function markNotificationAsRead(req, res, next) {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const notification = await notificationService.markAsRead(id, userId);

    res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
      notification
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc Mark all user notifications as read
 * @route PATCH /api/notifications/read-all
 * @access Private
 */
export async function markAllNotificationsAsRead(req, res, next) {
  try {
    const userId = req.user._id;

    const result = await notificationService.markAllAsRead(userId);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    next(error);
  }
}
