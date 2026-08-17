import { Router } from 'express';
import multer from 'multer';
import { requireAuth, optionalAuth, requireRole } from '../middleware/auth.js';
import { writeActionRateLimiter, generalApiRateLimiter } from '../middleware/rateLimiter.js';
import { uploadNote, getNotesByTutor, getNoteById, purchaseNote, searchNotes, getMyPurchases } from '../controllers/noteController.js';

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
 */
router.post('/', writeActionRateLimiter, requireAuth, upload.single('file'), uploadNote);

/**
 * GET /notes/purchases/me
 * GET /notes/purchases
 * Retrieve purchase records for the authenticated user (FR-10, Spec §8.5).
 * Supports status filtering: ?status=pending, completed, failed
 */
router.get('/purchases/me', generalApiRateLimiter, requireAuth, getMyPurchases);
router.get('/purchases', generalApiRateLimiter, requireAuth, getMyPurchases);

/**
 * GET /notes/search
 * GET /notes
 * Search and browse notes across the platform by keyword, course, price, or tutor (FR-10, Spec §8.5).
 * 
 * Query: ?q=calculus&course=MATH101&minPrice=0&maxPrice=100&sortBy=popular&page=1&limit=20
 */
router.get('/search', generalApiRateLimiter, searchNotes);
router.get('/', generalApiRateLimiter, searchNotes);

/**
 * GET /notes/tutor/:tutorId
 * Retrieve all notes uploaded by a specific tutor.
 */
router.get('/tutor/:tutorId', getNotesByTutor);

/**
 * GET /notes/:noteId
 * Retrieve a single note by ID with tutor details and optional purchase state.
 */
router.get('/:noteId', optionalAuth, getNoteById);


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
router.post('/:noteId/purchase', writeActionRateLimiter, requireAuth, purchaseNote);

export default router;
