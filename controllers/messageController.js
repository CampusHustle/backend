import mongoose from 'mongoose';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { Booking } from '../models/Booking.js';
import { AppError } from '../middleware/errorHandler.js';
import { buildConversationId } from '../socket/socketServer.js';

/**
 * GET /api/messages/conversations
 * Returns recent active conversations for the authenticated user with peer details.
 */
export async function getConversations(req, res, next) {
  try {
    const userId = req.user._id.toString();
    const userObjId = req.user._id;

    const conversationSummaries = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: userObjId },
            { conversationId: { $regex: userId } }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          totalCount: { $sum: 1 }
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    const conversations = await Promise.all(
      conversationSummaries.map(async (item) => {
        const parts = item._id.split('_');
        const peerId = parts[0] === userId ? parts[1] : parts[0];
        let peer = null;
        if (mongoose.Types.ObjectId.isValid(peerId)) {
          peer = await User.findById(peerId, {
            name: 1,
            email: 1,
            profilePicUrl: 1,
            department: 1,
            university: 1,
            role: 1
          }).lean();
        }
        return {
          conversationId: item._id,
          peer: peer || { _id: peerId, name: 'Campus Student', email: '', department: 'Peer' },
          lastMessage: item.lastMessage,
          totalMessages: item.totalCount
        };
      })
    );

    res.status(200).json({
      success: true,
      count: conversations.length,
      conversations
    });
  } catch (err) {
    next(err);
  }
}

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

    // Optional booking status check
    let booking = null;
    if (mongoose.Types.ObjectId.isValid(idA) && mongoose.Types.ObjectId.isValid(idB)) {
      booking = await Booking.findOne({
        $or: [
          { studentId: idA, tutorId: idB },
          { studentId: idB, tutorId: idA }
        ]
      }).lean();
    }

    // Pagination
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find({ conversationId })
        .sort({ createdAt: 1 }) // chronological order for thread
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
      hasConfirmedBooking: booking?.status === 'confirmed',
      bookingStatus: booking?.status || 'none',
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

    const conversationId = buildConversationId(userId, otherUserId);

    // Optional booking status check
    let booking = null;
    if (mongoose.Types.ObjectId.isValid(userId) && mongoose.Types.ObjectId.isValid(otherUserId)) {
      booking = await Booking.findOne({
        $or: [
          { studentId: userId, tutorId: otherUserId },
          { studentId: otherUserId, tutorId: userId }
        ]
      }).lean();
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find({ conversationId })
        .sort({ createdAt: 1 }) // chronological order for thread
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
      hasConfirmedBooking: booking?.status === 'confirmed',
      bookingStatus: booking?.status || 'none',
      messages
    });
  } catch (err) {
    next(err);
  }
}
