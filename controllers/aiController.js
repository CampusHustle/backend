import { Types } from 'mongoose';
import { askTutorAssistant, generateGeneralAiAnswer } from '../services/ragService.js';
import { extractTextFromPdfBuffer } from '../utils/pdfExtractor.js';
import { AppError } from '../middleware/errorHandler.js';
import Tesseract from 'tesseract.js';
import { AiConversation } from '../models/AiConversation.js';
import { AiMessage } from '../models/AiMessage.js';

/**
 * Controller to handle AI Study Assistant queries (both tutor-scoped and general study questions,
 * with real-time PDF extraction and OCR image analysis).
 * 
 * Satisfies FR-11 (Scoped AI Q&A) and Spec Section 8.6 (POST /api/ai/ask).
 * 
 * @param {Express.Request} req - Express request object
 *   - req.body: { tutorId?: string, question: string }
 *   - req.file?: Multer file buffer (PDF, image, text)
 * @param {Express.Response} res - Express response object
 * @param {Function} next - Express next() error handler
 */
export async function askQuestion(req, res, next) {
  try {
    const { tutorId, question, conversationId } = req.body || {};
    const file = req.file;

    const rawQuestion = question || (file ? `Analyze this attached study document: ${file.originalname}` : '');

    if (!rawQuestion || typeof rawQuestion !== 'string' || !rawQuestion.trim()) {
      throw new AppError('Question or file is required.', 400, 'INVALID_QUESTION');
    }

    const trimmedQuestion = rawQuestion.trim();

    if (trimmedQuestion.length > 5000) {
      throw new AppError('Question cannot exceed 5000 characters.', 400, 'QUESTION_TOO_LONG');
    }

    let conversation = null;
    if (conversationId) {
      if (!Types.ObjectId.isValid(conversationId)) {
        throw new AppError('Invalid AI conversation ID.', 400, 'INVALID_CONVERSATION_ID');
      }
      conversation = await AiConversation.findOne({ _id: conversationId, userId: req.user._id });
      if (!conversation) {
        throw new AppError('AI conversation not found.', 404, 'CONVERSATION_NOT_FOUND');
      }
    }

    let extractedDocumentText = '';
    if (file && file.buffer) {
      if (file.mimetype === 'application/pdf' || file.originalname?.toLowerCase().endsWith('.pdf')) {
        const segments = await extractTextFromPdfBuffer(file.buffer);
        extractedDocumentText = (Array.isArray(segments) ? segments : [])
          .map((s) => `[Page ${s.pageNumber}]:\n${s.text}`)
          .join('\n\n');
        
        // If pure-text stream extraction got empty (e.g. scanned image PDF), note this
        if (!extractedDocumentText.trim()) {
          extractedDocumentText = `PDF Document: ${file.originalname} (Binary/scanned content processed)`;
        }
      } else if (
        file.mimetype.startsWith('text/') ||
        file.originalname?.toLowerCase().endsWith('.txt') ||
        file.originalname?.toLowerCase().endsWith('.md') ||
        file.originalname?.toLowerCase().endsWith('.json')
      ) {
        extractedDocumentText = file.buffer.toString('utf-8');
      } else if (file.mimetype.startsWith('image/')) {
        try {
          const ocrResult = await Tesseract.recognize(file.buffer, 'eng+amh', {
            logger: () => {}
          });
          extractedDocumentText = ocrResult?.data?.text || '';
        } catch {
          extractedDocumentText = `Attached image: ${file.originalname}`;
        }
      }
    }

    let result;
    if (tutorId) {
      if (!Types.ObjectId.isValid(tutorId)) {
        throw new AppError('tutorId must be a valid ObjectId.', 400, 'INVALID_TUTOR_ID');
      }
      result = await askTutorAssistant(tutorId, trimmedQuestion, {
        documentContext: extractedDocumentText,
        fileName: file?.originalname
      });
    } else {
      result = await generateGeneralAiAnswer(trimmedQuestion, {
        documentContext: extractedDocumentText,
        fileName: file?.originalname
      });
    }

    if (!conversation) {
      const title = trimmedQuestion.slice(0, 200);
      conversation = await AiConversation.create({ userId: req.user._id, title });
    }

    const [userMessage, assistantMessage] = await AiMessage.create([
      { conversationId: conversation._id, role: 'user', content: trimmedQuestion },
      { conversationId: conversation._id, role: 'assistant', content: result.answer }
    ]);
    conversation.updatedAt = assistantMessage.createdAt;
    await conversation.save();

    res.status(200).json({
      success: true,
      conversationId: conversation._id,
      messages: [userMessage, assistantMessage],
      answer: result.answer,
      grounded: result.grounded !== undefined ? result.grounded : true,
      sources: result.sources || [],
      matchedChunksCount: result.matchedChunksCount || 0
    });
  } catch (error) {
    next(error);
  }
}
