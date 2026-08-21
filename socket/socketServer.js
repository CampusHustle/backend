import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { Booking } from '../models/Booking.js';
import { Message } from '../models/Message.js';
import { containsContactInfo } from '../utils/contactInfoDetector.js';
import { createNotification } from '../services/notificationService.js';


/**
 * Builds a deterministic conversationId from two user IDs.
 * Sorting ensures user A→B and B→A always produce the same room name.
 * @param {string} idA
 * @param {string} idB
 * @returns {string}
 */
let ioInstance = null;
const onlineUsersMap = new Map();

/**
 * Returns the active Socket.io server instance.
 * @returns {import('socket.io').Server|null}
 */
export function getIo() {
  return ioInstance;
}

/**
 * Checks whether a specific user currently has an active socket connection.
 * @param {string} userId
 * @returns {boolean}
 */
export function isUserOnline(userId) {
  if (!userId) return false;
  return onlineUsersMap.has(userId.toString()) && onlineUsersMap.get(userId.toString()).size > 0;
}

/**
 * Returns array of online user ID strings.
 * @returns {string[]}
 */
export function getOnlineUserIds() {
  return Array.from(onlineUsersMap.keys());
}

/**
 * Helper to emit an event to a specific user's personal room.
 * @param {string} userId
 * @param {string} event
 * @param {any} payload
 */
export function emitToUser(userId, event, payload) {
  if (!ioInstance || !userId) return;
  ioInstance.to(`user:${userId.toString()}`).emit(event, payload);
}

/**
 * Builds a deterministic conversationId from two user IDs.
 * Sorting ensures user A→B and B→A always produce the same room name.
 * @param {string} idA
 * @param {string} idB
 * @returns {string}
 */
export function buildConversationId(idA, idB) {
  return [idA.toString(), idB.toString()].sort().join('_');
}

/**
 * Checks whether two users have a confirmed booking between them.
 * Chat is only unlocked after a booking is accepted (FR-7).
 * @param {string} userIdA
 * @param {string} userIdB
 * @returns {Promise<boolean>}
 */
async function hasConfirmedBooking(userIdA, userIdB) {
  const booking = await Booking.findOne({
    status: 'confirmed',
    $or: [
      { studentId: userIdA, tutorId: userIdB },
      { studentId: userIdB, tutorId: userIdA }
    ]
  });
  return !!booking;
}

/**
 * Parses and verifies participant IDs from a conversationId string.
 * Returns null if the format is invalid.
 * @param {string} conversationId
 * @returns {{ idA: string, idB: string } | null}
 */
export function parseConversationId(conversationId) {
  if (typeof conversationId !== 'string') return null;
  const parts = conversationId.split('_');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { idA: parts[0], idB: parts[1] };
}

/**
 * Attaches the Socket.io server to an existing HTTP server instance.
 * Handles auth, room joining, messaging, and contact info detection.
 *
 * @param {import('socket.io').Server} io
 */
export function initSocketServer(io) {
  ioInstance = io;

  // ── Connection-level JWT auth (STRIDE: Spoofing) ──────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('AUTH_REQUIRED: No token provided.'));
      }

      let decoded;
      try {
        decoded = jwt.verify(token, config.jwtSecret);
      } catch {
        return next(new Error('AUTH_REQUIRED: Invalid or expired token.'));
      }

      const user = await User.findById(decoded.userId);
      if (!user || user.isBlocked) {
        return next(new Error('AUTH_REQUIRED: User not found or suspended.'));
      }

      // Attach user to socket for use in event handlers
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('AUTH_REQUIRED: Authentication failed.'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    const now = new Date();

    // Track active connected socket
    if (!onlineUsersMap.has(userId)) {
      onlineUsersMap.set(userId, new Set());
    }
    onlineUsersMap.get(userId).add(socket.id);

    // Update user's lastActiveAt timestamp in DB
    User.findByIdAndUpdate(userId, { $set: { lastActiveAt: now } }).catch(() => {});

    // Broadcast user online status
    io.emit('user:status', {
      userId,
      isOnline: true,
      lastActiveAt: now.toISOString()
    });

    // Send current list of online users to newly connected socket
    socket.emit('users:online_list', {
      onlineUserIds: Array.from(onlineUsersMap.keys())
    });

    // Handle heartbeat to keep presence refreshed
    socket.on('user:heartbeat', async () => {
      const pingTime = new Date();
      User.findByIdAndUpdate(userId, { $set: { lastActiveAt: pingTime } }).catch(() => {});
      io.emit('user:status', {
        userId,
        isOnline: true,
        lastActiveAt: pingTime.toISOString()
      });
    });

    // Automatically join the user's personal room for direct notifications
    socket.join(`user:${userId}`);

    // ── join_conversation ───────────────────────────────────────────────────
    socket.on('join_conversation', async ({ conversationId } = {}) => {
      const parsed = parseConversationId(conversationId);
      if (!parsed) {
        return socket.emit('error', { code: 'INVALID_CONVERSATION', message: 'Invalid conversation ID format.' });
      }

      const { idA, idB } = parsed;

      // Only participants can join the room (STRIDE: Elevation of Privilege)
      if (userId !== idA && userId !== idB) {
        return socket.emit('error', { code: 'FORBIDDEN', message: 'You are not a participant in this conversation.' });
      }

      socket.join(conversationId);
      socket.emit('joined_conversation', { conversationId });
    });

    // ── leave_conversation ──────────────────────────────────────────────────
    socket.on('leave_conversation', ({ conversationId } = {}) => {
      if (conversationId) {
        socket.leave(conversationId);
      }
    });

    // ── message:send ────────────────────────────────────────────────────────
    socket.on('message:send', async ({ conversationId, content } = {}) => {
      try {
        // Input validation
        if (typeof conversationId !== 'string' || !conversationId.trim()) {
          return socket.emit('error', { code: 'VALIDATION_ERROR', message: 'conversationId is required.' });
        }
        if (typeof content !== 'string' || !content.trim()) {
          return socket.emit('error', { code: 'VALIDATION_ERROR', message: 'Message content cannot be empty.' });
        }
        if (content.length > 2000) {
          return socket.emit('error', { code: 'VALIDATION_ERROR', message: 'Message cannot exceed 2000 characters.' });
        }

        const parsed = parseConversationId(conversationId);
        if (!parsed) {
          return socket.emit('error', { code: 'INVALID_CONVERSATION', message: 'Invalid conversation ID format.' });
        }

        const { idA, idB } = parsed;

        // Ensure sender is a participant (STRIDE: Elevation of Privilege)
        if (userId !== idA && userId !== idB) {
          return socket.emit('error', { code: 'FORBIDDEN', message: 'You are not a participant in this conversation.' });
        }

        const otherId = userId === idA ? idB : idA;

        // FR-8: Detect and flag contact info (audit trail for admin, NFR-9)
        const hasContactInfo = containsContactInfo(content);

        // Persist message to MongoDB
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
            _id: socket.user._id,
            name: socket.user.name,
            profilePicUrl: socket.user.profilePicUrl,
            department: socket.user.department
          }
        };

        // Broadcast to all sockets in the room (including sender for confirmation)
        io.to(conversationId).emit('message:receive', payload);

        // Deliver live real-time notification badge event to recipient's personal room
        io.to(`user:${otherId}`).emit('message:notify', payload);
      } catch (err) {
        console.error('[Socket] message:send error:', err.message);
        socket.emit('error', { code: 'SERVER_ERROR', message: 'Failed to send message.' });
      }
    });

    // ── message:mark_read ───────────────────────────────────────────────────
    socket.on('message:mark_read', async ({ conversationId } = {}) => {
      try {
        if (!conversationId) return;
        const parsed = parseConversationId(conversationId);
        if (!parsed) return;
        const { idA, idB } = parsed;
        if (userId !== idA && userId !== idB) return;

        const otherId = userId === idA ? idB : idA;

        await Message.updateMany(
          { conversationId, senderId: otherId, isRead: false },
          { $set: { isRead: true, readAt: new Date() } }
        );

        io.to(conversationId).emit('message:read_receipt', { conversationId, readerId: userId });
        io.to(`user:${userId}`).emit('message:unread_updated');
      } catch (err) {
        console.error('[Socket] message:mark_read error:', err.message);
      }
    });

    // ── disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const userSockets = onlineUsersMap.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsersMap.delete(userId);
          const disconnectTime = new Date();
          User.findByIdAndUpdate(userId, { $set: { lastActiveAt: disconnectTime } }).catch(() => {});
          io.emit('user:status', {
            userId,
            isOnline: false,
            lastActiveAt: disconnectTime.toISOString()
          });
        }
      }
    });
  });
}
