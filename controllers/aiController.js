import { Types } from 'mongoose';
import { askTutorAssistant, generateGeneralAiAnswer } from '../services/ragService.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Controller to handle AI Study Assistant queries (both tutor-scoped and general study questions).
 * 
 * Satisfies FR-11 (Scoped AI Q&A) and Spec Section 8.6 (POST /api/ai/ask).
 * 
 * @param {Express.Request} req - Express request object
 *   - req.body: { tutorId?: string, question: string }
 * @param {Express.Response} res - Express response object
 * @param {Function} next - Express next() error handler
 */
export async function askQuestion(req, res, next) {
  try {
    const { tutorId, question } = req.body || {};

    if (!question || typeof question !== 'string' || !question.trim()) {
      throw new AppError('Question is required and must be a non-empty string.', 400, 'INVALID_QUESTION');
    }

    const trimmedQuestion = question.trim();
    if (trimmedQuestion.length < 3) {
      throw new AppError('Question must be at least 3 characters long.', 400, 'QUESTION_TOO_SHORT');
    }

    if (trimmedQuestion.length > 1000) {
      throw new AppError('Question cannot exceed 1000 characters.', 400, 'QUESTION_TOO_LONG');
    }

    let result;
    if (tutorId) {
      if (!Types.ObjectId.isValid(tutorId)) {
        throw new AppError('tutorId must be a valid ObjectId.', 400, 'INVALID_TUTOR_ID');
      }
      result = await askTutorAssistant(tutorId, trimmedQuestion);
    } else {
      result = await generateGeneralAiAnswer(trimmedQuestion);
    }

    res.status(200).json({
      success: true,
      answer: result.answer,
      grounded: result.grounded !== undefined ? result.grounded : true,
      sources: result.sources || [],
      matchedChunksCount: result.matchedChunksCount || 0
    });
  } catch (error) {
    next(error);
  }
}
