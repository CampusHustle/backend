import { Types } from 'mongoose';
import { AiConversation } from '../models/AiConversation.js';
import { AiMessage } from '../models/AiMessage.js';
import { AppError } from '../middleware/errorHandler.js';

function requireConversationId(conversationId) {
  if (!Types.ObjectId.isValid(conversationId)) {
    throw new AppError('Invalid AI conversation ID.', 400, 'INVALID_CONVERSATION_ID');
  }
}

async function findOwnedConversation(conversationId, userId) {
  requireConversationId(conversationId);
  const conversation = await AiConversation.findOne({ _id: conversationId, userId });
  if (!conversation) {
    throw new AppError('AI conversation not found.', 404, 'CONVERSATION_NOT_FOUND');
  }
  return conversation;
}

export async function getAiConversations(req, res, next) {
  try {
    const conversations = await AiConversation.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .lean();
    res.status(200).json({ success: true, count: conversations.length, conversations });
  } catch (error) {
    next(error);
  }
}

export async function createAiConversation(req, res, next) {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title) {
      throw new AppError('Conversation title is required.', 400, 'VALIDATION_ERROR');
    }
    const conversation = await AiConversation.create({ userId: req.user._id, title });
    res.status(201).json({ success: true, conversation });
  } catch (error) {
    next(error);
  }
}

export async function getAiConversationMessages(req, res, next) {
  try {
    const conversation = await findOwnedConversation(req.params.conversationId, req.user._id);
    const messages = await AiMessage.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .lean();
    res.status(200).json({ success: true, conversation, messages });
  } catch (error) {
    next(error);
  }
}

export async function deleteAiConversation(req, res, next) {
  try {
    const conversation = await findOwnedConversation(req.params.conversationId, req.user._id);
    await AiMessage.deleteMany({ conversationId: conversation._id });
    await conversation.deleteOne();
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
}
