import mongoose from 'mongoose';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { Booking } from '../models/Booking.js';
import { AppError } from '../middleware/errorHandler.js';
import { buildConversationId, parseConversationId, getIo, emitToUser } from '../socket/socketServer.js';
import { containsContactInfo } from '../utils/contactInfoDetector.js';
import { createNotification } from '../services/notificationService.js';

/**
 * GET /api/messages/conversations
 * Returns recent active conversations for the authenticated user with peer details and unread counts.
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

        const unreadCount = await Message.countDocuments({
          conversationId: item._id,
          senderId: peerId,
          isRead: false
        });

        return {
          conversationId: item._id,
          peer: peer || { _id: peerId, name: 'Campus Student', email: '', department: 'Peer' },
          lastMessage: item.lastMessage,
          totalMessages: item.totalCount,
          unreadCount
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
 * GET /api/messages/unread-count
 * Returns total unread messages count across all conversations for the authenticated user.
 */
export async function getUnreadCount(req, res, next) {
  try {
    const userId = req.user._id.toString();
    const userObjId = req.user._id;

    const count = await Message.countDocuments({
      conversationId: { $regex: userId },
      senderId: { $ne: userObjId },
      isRead: false
    });

    res.status(200).json({
      success: true,
      count
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/messages/:conversationId/read
 * Marks all messages in the conversation sent by peer as read.
 */
export async function markConversationAsRead(req, res, next) {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id.toString();

    const parsed = parseConversationId(conversationId);
    if (!parsed) {
      throw new AppError('Invalid conversation ID format.', 400, 'INVALID_CONVERSATION');
    }

    const { idA, idB } = parsed;
    if (userId !== idA && userId !== idB) {
      throw new AppError('You are not a participant in this conversation.', 403, 'FORBIDDEN');
    }

    const peerId = userId === idA ? idB : idA;

    const result = await Message.updateMany(
      { conversationId, senderId: peerId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    const io = getIo();
    if (io) {
      io.to(conversationId).emit('message:read_receipt', { conversationId, readerId: userId });
      emitToUser(userId, 'message:unread_updated', { conversationId });
    }

    res.status(200).json({
      success: true,
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/messages/send
 * Sends a message via REST endpoint (with live socket broadcast).
 */
export async function sendMessage(req, res, next) {
  try {
    const userId = req.user._id.toString();
    const { conversationId: rawConvId, otherUserId, content } = req.body;

    if (typeof content !== 'string' || !content.trim()) {
      throw new AppError('Message content cannot be empty.', 400, 'VALIDATION_ERROR');
    }
    if (content.length > 2000) {
      throw new AppError('Message cannot exceed 2000 characters.', 400, 'VALIDATION_ERROR');
    }

    let conversationId = rawConvId;
    let targetUserId = otherUserId;

    if (!conversationId && targetUserId) {
      conversationId = buildConversationId(userId, targetUserId);
    }

    if (!conversationId) {
      throw new AppError('conversationId or otherUserId is required.', 400, 'VALIDATION_ERROR');
    }

    const parsed = parseConversationId(conversationId);
    if (!parsed) {
      throw new AppError('Invalid conversation ID format.', 400, 'INVALID_CONVERSATION');
    }

    const { idA, idB } = parsed;
    if (userId !== idA && userId !== idB) {
      throw new AppError('You are not a participant in this conversation.', 403, 'FORBIDDEN');
    }

    const otherId = userId === idA ? idB : idA;
    const hasContactInfo = containsContactInfo(content);

    const message = await Message.create({
      conversationId,
      senderId: userId,
      content: content.trim(),
      containsContactInfo: hasContactInfo,
      isRead: false
    });

    const payload = {
      _id: message._id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      containsContactInfo: message.containsContactInfo,
      isRead: message.isRead,
      createdAt: message.createdAt,
      sender: {
        _id: req.user._id,
        name: req.user.name,
        profilePicUrl: req.user.profilePicUrl,
        department: req.user.department
      }
    };

    const io = getIo();
    if (io) {
      io.to(conversationId).emit('message:receive', payload);
      emitToUser(otherId, 'message:notify', payload);
    }

    res.status(201).json({
      success: true,
      message: payload
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/messages/:conversationId
 * Returns paginated message history for a conversation.
 */
export async function getMessages(req, res, next) {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id.toString();

    if (typeof conversationId !== 'string' || !conversationId.trim()) {
      throw new AppError('conversationId is required.', 400, 'VALIDATION_ERROR');
    }

    const parsed = parseConversationId(conversationId);
    if (!parsed) {
      throw new AppError('Invalid conversation ID format.', 400, 'INVALID_CONVERSATION');
    }

    const { idA, idB } = parsed;
    if (userId !== idA && userId !== idB) {
      throw new AppError('You are not a participant in this conversation.', 403, 'FORBIDDEN');
    }

    let booking = null;
    if (mongoose.Types.ObjectId.isValid(idA) && mongoose.Types.ObjectId.isValid(idB)) {
      booking = await Booking.findOne({
        $or: [
          { studentId: idA, tutorId: idB },
          { studentId: idB, tutorId: idA }
        ]
      }).lean();
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find({ conversationId })
        .sort({ createdAt: 1 })
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
 */
export async function getMessagesByUser(req, res, next) {
  try {
    const userId = req.user._id.toString();
    const { otherUserId } = req.params;

    const conversationId = buildConversationId(userId, otherUserId);

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
        .sort({ createdAt: 1 })
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
