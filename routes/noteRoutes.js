import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadNote, getNotesByTutor, getNoteById, purchaseNote } from '../controllers/noteController.js';

const router = Router();

/**
 * Configure Multer memory storage for buffer handling before Cloudinary upload.
 * NFR compliance:
 *   - Memory storage allows streaming to Cloudinary without disk I/O overhead
 *   - Size limits prevent abuse and storage exhaustion
 *   - File-type validation deferred to controller for detailed error messages
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB hard limit before Cloudinary (per file)
  }
});

/**
 * POST /notes
 * Upload a note file (PDF or image) with metadata.
 * 
 * Authentication: Required (Bearer JWT)
 * Authorization: Tutor role (or student with tutor capability)
 * 
 * Request:
 *   multipart/form-data:
 *     - file: binary (PDF, JPEG, PNG, WebP) — max 10MB
 *     - title: string (required) — note title
 *     - course: string (required) — course code/name
 *     - description: string (optional) — note summary
 *     - price: number (optional, default 0) — selling price in currency units
 *     - previewPages: number (optional, default 3) — pages shown in preview
 * 
 * Response (201):
 *   {
 *     success: true,
 *     message: "Note uploaded successfully.",
 *     note: {
 *       _id, tutorId, title, course, description, fileUrl,
 *       price, previewPages, purchaseCount: 0, createdAt, updatedAt
 *     }
 *   }
 * 
 * Errors (400, 413, 500):
 * Errors (400, 413, 500):
 *   - NO_FILE_PROVIDED: multipart form missing 'file' field
 *   - MISSING_REQUIRED_FIELDS: title or course missing
 *   - UNSUPPORTED_FILE_TYPE: MIME type not in whitelist
 *   - FILE_SIZE_EXCEEDED: file size exceeds per-type limit
 *   - INVALID_PRICE_FORMAT: price is not a valid number
 *   - PRICE_OUT_OF_RANGE: price not between 0 and 100,000
 *   - CLOUDINARY_UPLOAD_FAILED: Cloudinary API error (graceful degradation)
 * 
 * FR-9 compliance: Accepts PDF and images for OCR
 * NFR-1 compliance: Auth via JWT
 * NFR-10 compliance: Graceful error if Cloudinary rate-limited
 */
router.post('/', requireAuth, upload.single('file'), uploadNote);

/**
 * GET /notes/tutor/:tutorId
 * Retrieve all notes uploaded by a specific tutor.
 * 
 * Response (200):
 *   {
 *     success: true,
 *     count: number,
 *     notes: [{ _id, title, course, price, ... }]
 *   }
 * 
 * Used for tutor profile pages and search results.
 */
router.get('/tutor/:tutorId', getNotesByTutor);

/**
 * GET /notes/:noteId
 * Retrieve a single note by ID.
 * 
 * Response (200):
 *   {
 *     success: true,
 *     note: { _id, tutorId, title, course, fileUrl, price, ... }
 *   }
 * 
 * Errors (404):
 *   - NOTE_NOT_FOUND: noteId does not exist
 * 
 * Used for note detail/preview pages.
 */
router.get('/:noteId', getNoteById);

/**
 * POST /notes/:noteId/purchase
 * Record a purchase of a note by a student.
 * 
 * Day 6: Stub implementation creating Purchase record with pending status.
 * Chapa payment integration deferred to Day 9.
 * 
 * Authentication: Required (Bearer JWT)
 * Authorization: Any authenticated student (verified in controller)
 * 
 * Request:
 *   {} (empty body)
 * 
 * Response (201):
 *   {
 *     success: true,
 *     message: "Note purchase initiated. Awaiting payment confirmation.",
 *     purchase: {
 *       _id, studentId, noteId, tutorId, price,
 *       status: "pending", createdAt, updatedAt
 *     }
 *   }
 * 
 * Errors (400, 403, 404):
 *   - NOTE_NOT_FOUND: noteId does not exist
 *   - NOTE_ALREADY_PURCHASED: student has already purchased this note
 *   - CANNOT_PURCHASE_OWN_NOTE: tutor trying to purchase their own note
 *   - INVALID_NOTE_PRICE: note price is not a valid number
 * 
 * FR-10 compliance: System supports pricing and purchase of notes
 * NFR-1 compliance: Auth via JWT
 */
router.post('/:noteId/purchase', requireAuth, purchaseNote);

export default router;
