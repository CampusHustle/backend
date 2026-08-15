import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Note from '../models/Note.js';
import cloudinary from '../config/cloudinary.js';
import { AppError } from '../middleware/errorHandler.js';
import { processOcrToPdf } from '../utils/ocrHelper.js';

/**
 * Supported file types for note uploads.
 * PDFs for direct uploads, and images for OCR conversion (Day 5+).
 * NFR-10: Graceful degradation when file processing services are rate-limited.
 */
const ALLOWED_MIME_TYPES = {
  'application/pdf': { extension: 'pdf', category: 'document' },
  'image/jpeg': { extension: 'jpg', category: 'image' },
  'image/png': { extension: 'png', category: 'image' },
  'image/webp': { extension: 'webp', category: 'image' }
};

/**
 * Maximum file size in bytes.
 * PDFs: 10MB (standard textbook PDFs)
 * Images: 5MB (high-quality scans)
 * NFR compliance: Reasonable limits to prevent abuse and storage exhaustion.
 */
const MAX_FILE_SIZE = {
  'application/pdf': 10 * 1024 * 1024,      // 10MB for PDFs
  'image/jpeg': 5 * 1024 * 1024,            // 5MB for JPEG
  'image/png': 5 * 1024 * 1024,             // 5MB for PNG
  'image/webp': 5 * 1024 * 1024             // 5MB for WebP
};

export async function prepareUploadedNoteFile(file, ocrRunner = processOcrToPdf) {
  const mimeType = file.mimetype;

  if (!ALLOWED_MIME_TYPES[mimeType]) {
    const supportedTypes = Object.keys(ALLOWED_MIME_TYPES).join(', ');
    throw new AppError(
      `Unsupported file type: ${mimeType}. Supported types: ${supportedTypes}`,
      400,
      'UNSUPPORTED_FILE_TYPE'
    );
  }

  if (mimeType === 'application/pdf') {
    return file;
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'campushustle-ocr-'));
  const originalBaseName = path.basename(file.originalname || 'note', path.extname(file.originalname || 'note')) || 'note';
  const inputPath = path.join(tempDir, `${originalBaseName}${path.extname(file.originalname || '.png') || '.png'}`);
  const outputPath = path.join(tempDir, `${originalBaseName}.pdf`);

  try {
    await fs.writeFile(inputPath, file.buffer);
    const ocrResult = await ocrRunner(inputPath, outputPath);
    const extractedText = typeof ocrResult === 'object' && ocrResult && ocrResult.extractedText ? ocrResult.extractedText : '';
    const confidence = typeof ocrResult === 'object' && ocrResult && Number.isFinite(Number(ocrResult.confidence)) ? Number(ocrResult.confidence) : 100;

    if (!extractedText.trim()) {
      throw new AppError(
        'OCR produced no readable text. Please upload a clearer image or a PDF instead.',
        400,
        'OCR_NO_TEXT_FOUND'
      );
    }

    if (confidence > 0 && confidence < 45) {
      throw new AppError(
        `OCR confidence too low (${confidence}%). Please upload a clearer image or a PDF instead.`,
        400,
        'OCR_LOW_CONFIDENCE'
      );
    }

    const convertedBuffer = await fs.readFile(outputPath);

    return {
      ...file,
      buffer: convertedBuffer,
      mimetype: 'application/pdf',
      originalname: `${originalBaseName}.pdf`,
      size: convertedBuffer.length
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      'OCR conversion failed. Please upload a clearer image or a PDF instead.',
      400,
      'OCR_PROCESSING_FAILED'
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Upload a note file to Cloudinary and save metadata to MongoDB.
 * Supports both PDF uploads and image uploads, converting images to PDF with Tesseract OCR.
 *
 * Flow:
 *   1. Validate file presence
 *   2. Validate MIME type (FR-9 compliance, NFR security)
 *   3. Validate file size (NFR storage limits)
 *   4. Convert uploaded image to PDF using Tesseract OCR and PDFKit
 *   5. Upload to Cloudinary with resource-type inference
 *   6. Save Note document to MongoDB with file URL and metadata
 *   7. Return created Note
 *
 * Errors:
 *   - 400 if no file provided
 *   - 400 if file type not supported
 *   - 413 if file exceeds size limit
 *   - 400 if OCR conversion fails
 *   - 500 if Cloudinary upload fails (with graceful error message)
 *   - 500 if MongoDB save fails
 *
 * @param {Express.Request} req - Express request object
 *   - req.file: {buffer, mimetype, originalname} from multer
 *   - req.body: {title, course, description, price, previewPages}
 *   - req.user: Authenticated user from requireAuth middleware
 * @param {Express.Response} res - Express response object
 * @param {Function} next - Express next() error handler
 */
export async function uploadNote(req, res, next) {
  try {
    // 1. Validate file presence
    if (!req.file) {
      throw new AppError(
        'No file provided. Please upload a PDF or image file.',
        400,
        'NO_FILE_PROVIDED'
      );
    }

    const file = req.file;
    const mimeType = file.mimetype;
    const fileSize = file.size;

    // 2. Validate MIME type
    if (!ALLOWED_MIME_TYPES[mimeType]) {
      const supportedTypes = Object.keys(ALLOWED_MIME_TYPES).join(', ');
      throw new AppError(
        `Unsupported file type: ${mimeType}. Supported types: ${supportedTypes}`,
        400,
        'UNSUPPORTED_FILE_TYPE'
      );
    }

    // 3. Validate file size
    const maxSize = MAX_FILE_SIZE[mimeType];
    if (fileSize > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
      const actualSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
      throw new AppError(
        `File size (${actualSizeMB}MB) exceeds limit (${maxSizeMB}MB) for ${ALLOWED_MIME_TYPES[mimeType].extension.toUpperCase()} files.`,
        413,
        'FILE_SIZE_EXCEEDED'
      );
    }

    const processedFile = await prepareUploadedNoteFile(file);
    const processedMimeType = processedFile.mimetype;

    // Extract note metadata from request body
    const { title, course, description, price, previewPages } = req.body || {};

    if (!title || !course) {
      throw new AppError(
        'Title and course are required fields.',
        400,
        'MISSING_REQUIRED_FIELDS'
      );
    }

    // 4. Upload to Cloudinary
    // Determine resource type based on the final processed file type
    const resourceType = processedMimeType === 'application/pdf' ? 'raw' : 'image';

    let cloudinaryUploadResult;
    try {
      cloudinaryUploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: resourceType,
            folder: 'campushustle/notes',
            public_id: `${req.user._id}_${Date.now()}_${processedFile.originalname
              .replace(/\s+/g, '_')
              .split('.')
              .slice(0, -1)
              .join('.')}`,
            overwrite: true,
            quality: 'auto'
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        );

        uploadStream.end(processedFile.buffer);
      });
    } catch (cloudinaryError) {
      console.error('[Cloudinary Upload Error]', cloudinaryError);
      throw new AppError(
        'File upload to storage service failed. Please try again later.',
        500,
        'CLOUDINARY_UPLOAD_FAILED'
      );
    }

    // 5. Save Note document to MongoDB
    const note = new Note({
      tutorId: req.user._id,
      title: title.trim(),
      course: course.trim(),
      description: description ? description.trim() : '',
      fileUrl: cloudinaryUploadResult.secure_url,
      price: parseFloat(price) || 0,
      previewPages: parseInt(previewPages) || 3
    });

    const savedNote = await note.save();

    // 6. Return created Note
    res.status(201).json({
      success: true,
      message: 'Note uploaded successfully.',
      note: savedNote
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Fetch all notes created by a specific tutor.
 * Used for tutor profile pages to display their offerings.
 *
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Function} next
 */
export async function getNotesByTutor(req, res, next) {
  try {
    const { tutorId } = req.params;

    const notes = await Note.find({ tutorId })
      .sort({ createdAt: -1 })
      .select('-__v');

    res.status(200).json({
      success: true,
      count: notes.length,
      notes
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Fetch a single note by ID.
 * Used for note detail/preview pages.
 *
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Function} next
 */
export async function getNoteById(req, res, next) {
  try {
    const { noteId } = req.params;

    const note = await Note.findById(noteId);
    if (!note) {
      throw new AppError('Note not found.', 404, 'NOTE_NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      note
    });
  } catch (error) {
    next(error);
  }
}
