import { Notification } from '../models/Notification.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Creates and persists a notification document.
 * Safely handles self-notification suppression and input validation.
 *
 * @param {Object} params
 * @param {string} params.recipientId - Target user ID
 * @param {string} [params.senderId] - Triggering user ID
 * @param {string} params.type - Notification type enum
 * @param {string} params.title - Short title header
 * @param {string} params.message - Descriptive text
 * @param {string} [params.referenceId] - Associated object ID
 * @param {string} [params.referenceType] - Type of referenced object
 * @returns {Promise<Notification|null>}
 */
export async function createNotification({
  recipientId,
  senderId,
  type,
  title,
  message,
  referenceId,
  referenceType
}) {
  try {
    if (!recipientId || !type || !title || !message) {
      return null;
    }

    // Suppress self-notifications
    if (senderId && recipientId.toString() === senderId.toString()) {
      return null;
    }

    const notification = new Notification({
      recipientId,
      senderId,
      type,
      title,
      message,
      referenceId,
      referenceType
    });

    return await notification.save();
  } catch (err) {
    console.error('[NotificationService] Failed to create notification:', err.message);
    return null;
  }
}

/**
 * Retrieves paginated notifications for a given user.
 *
 * @param {string} userId
 * @param {Object} options
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @param {boolean} [options.unreadOnly=false]
 */
export async function getUserNotifications(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const filter = { recipientId: userId };
  if (unreadOnly) {
    filter.isRead = false;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .populate('senderId', 'name email department profilePicUrl')
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipientId: userId, isRead: false })
  ]);

  return {
    notifications,
    total,
    unreadCount,
    page: parsedPage,
    totalPages: Math.ceil(total / parsedLimit) || 0
  };
}

/**
 * Get count of unread notifications for a user.
 * @param {string} userId
 */
export async function getUnreadCount(userId) {
  const unreadCount = await Notification.countDocuments({ recipientId: userId, isRead: false });
  return { unreadCount };
}

/**
 * Marks a specific notification as read.
 * @param {string} notificationId
 * @param {string} userId
 */
export async function markAsRead(notificationId, userId) {
  const notification = await Notification.findOne({ _id: notificationId, recipientId: userId });
  if (!notification) {
    throw new AppError('Notification not found.', 404, 'NOT_FOUND');
  }

  notification.isRead = true;
  await notification.save();
  return notification;
}

/**
 * Marks all notifications for a user as read.
 * @param {string} userId
 */
export async function markAllAsRead(userId) {
  const result = await Notification.updateMany(
    { recipientId: userId, isRead: false },
    { $set: { isRead: true } }
  );

  return { modifiedCount: result.modifiedCount };
}
