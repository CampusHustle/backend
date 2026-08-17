import { Message } from '../models/Message.js';
import { Booking } from '../models/Booking.js';
import { AppError } from '../middleware/errorHandler.js';
import { buildConversationId } from '../socket/socketServer.js';

/**
 * GET /api/messages/:conversationId
 * Returns paginated message history for a conversation.
 * Only participants (users whose IDs are in the conversationId) can fetch.
 *
 * Query params:
 *   - page: number (default 1)
 *   - limit: number (default 50, max 50)
 */
export async function getMessages(req, res, next) {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id.toString();

    if (typeof conversationId !== 'string' || !conversationId.trim()) {
      throw new AppError('conversationId is required.', 400, 'VALIDATION_ERROR');
    }

    // Validate the calling user is a participant
    const parts = conversationId.split('_');
    if (parts.length !== 2 || (!parts[0] || !parts[1])) {
      throw new AppError('Invalid conversation ID format.', 400, 'INVALID_CONVERSATION');
    }

    const [idA, idB] = parts;
    if (userId !== idA && userId !== idB) {
      throw new AppError('You are not a participant in this conversation.', 403, 'FORBIDDEN');
    }

    // Verify a confirmed booking exists between participants
    const booking = await Booking.findOne({
      status: 'confirmed',
      $or: [
        { studentId: idA, tutorId: idB },
        { studentId: idB, tutorId: idA }
      ]
    });

    if (!booking) {
      throw new AppError(
        'Message history is only available for confirmed bookings.',
        403,
        'BOOKING_REQUIRED'
      );
    }

    // Pagination
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find({ conversationId })
        .sort({ createdAt: -1 }) // newest first
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments({ conversationId })
    ]);

    res.status(200).json({
      success: true,
      conversationId,
      page,
      totalPages: Math.ceil(total / limit) || 0,
      total,
      messages
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/messages/conversation/:otherUserId
 * Convenience: derive conversationId from the other user's ID and redirect to history.
 * Useful for frontend — pass the other user's ID, get messages back directly.
 */
export async function getMessagesByUser(req, res, next) {
  try {
    const userId = req.user._id.toString();
    const { otherUserId } = req.params;

    if (typeof otherUserId !== 'string' || !otherUserId.trim()) {
      throw new AppError('otherUserId is required.', 400, 'VALIDATION_ERROR');
    }

    const conversationId = buildConversationId(userId, otherUserId);

    // Verify confirmed booking
    const booking = await Booking.findOne({
      status: 'confirmed',
      $or: [
        { studentId: userId, tutorId: otherUserId },
        { studentId: otherUserId, tutorId: userId }
      ]
    });

    if (!booking) {
      throw new AppError(
        'Message history is only available for confirmed bookings.',
        403,
        'BOOKING_REQUIRED'
      );
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find({ conversationId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments({ conversationId })
    ]);

    res.status(200).json({
      success: true,
      conversationId,
      page,
      totalPages: Math.ceil(total / limit) || 0,
      total,
      messages
    });
  } catch (err) {
    next(err);
  }
}
