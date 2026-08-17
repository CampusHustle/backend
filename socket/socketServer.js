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
export function buildConversationId(idA, idB) {
  return [idA, idB].sort().join('_');
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
function parseConversationId(conversationId) {
  if (typeof conversationId !== 'string') return null;
  const parts = conversationId.split('_');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { idA: parts[0], idB: parts[1] };
}

/**
 * Attaches the Socket.io server to an existing HTTP server instance.
 * Handles auth, room joining, messaging, and contact info detection.
 *
 * Security posture:
 *   - Spoofing: JWT verified on every connection before socket is accepted
 *   - Elevation of Privilege: participant membership checked before every message
 *   - Repudiation: contact info flagged and persisted with timestamp (FR-8, NFR-9)
 *   - DoS: message length capped at 2000 chars; rate limiting via express-rate-limit on REST side
 *
 * @param {import('http').Server} httpServer
 * @param {import('socket.io').Server} io
 */
export function initSocketServer(io) {
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

    // ── join_conversation ───────────────────────────────────────────────────
    // Client sends: { conversationId: "idA_idB" }
    // Server validates membership and joins the socket room
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

      const otherId = userId === idA ? idB : idA;

      // Chat requires a confirmed booking (FR-7)
      const canChat = await hasConfirmedBooking(userId, otherId);
      if (!canChat) {
        return socket.emit('error', {
          code: 'BOOKING_REQUIRED',
          message: 'Chat is only available after a booking has been confirmed.'
        });
      }

      socket.join(conversationId);
      socket.emit('joined_conversation', { conversationId });
    });

    // ── message:send ────────────────────────────────────────────────────────
    // Client sends: { conversationId: "idA_idB", content: "Hello!" }
    // Server validates, saves, detects contact info, and broadcasts
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

        // Re-verify confirmed booking on every message (booking could be cancelled mid-chat)
        const canChat = await hasConfirmedBooking(userId, otherId);
        if (!canChat) {
          return socket.emit('error', {
            code: 'BOOKING_REQUIRED',
            message: 'Chat requires an active confirmed booking.'
          });
        }

        // FR-8: Detect and flag contact info (audit trail for admin, NFR-9)
        const hasContactInfo = containsContactInfo(content);

        // Persist message to MongoDB
        const message = await Message.create({
          conversationId,
          senderId: userId,
          content: content.trim(),
          containsContactInfo: hasContactInfo
        });

        const payload = {
          _id: message._id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          content: message.content,
          containsContactInfo: message.containsContactInfo,
          createdAt: message.createdAt
        };

        // Broadcast to all sockets in the room (including sender for confirmation)
        io.to(conversationId).emit('message:receive', payload);

        // FR-14: Trigger notification for message recipient
        const snippet = content.trim().length > 50 ? `${content.trim().substring(0, 47)}...` : content.trim();
        await createNotification({
          recipientId: otherId,
          senderId: userId,
          type: 'new_message',
          title: 'New Message',
          message: snippet,
          referenceId: message._id,
          referenceType: 'message'
        });

      } catch (err) {
        console.error('[Socket] message:send error:', err.message);
        socket.emit('error', { code: 'SERVER_ERROR', message: 'Failed to send message.' });
      }
    });

    // ── disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      // Socket.io automatically removes the socket from all rooms on disconnect
    });
  });
}
