import express from 'express';
import {
  createAvailability,
  getTutorAvailability,
  getMyAvailability,
  updateAvailability,
  deleteAvailability,
} from '../controllers/availabilityController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Private tutor routes
router.post('/', requireAuth, createAvailability);
router.get('/me', requireAuth, getMyAvailability);
router.put('/:id', requireAuth, updateAvailability);
router.delete('/:id', requireAuth, deleteAvailability);

// Public / Authenticated tutor slot lookup
router.get('/tutor/:tutorId', getTutorAvailability);
router.get('/:tutorId', getTutorAvailability);

export default router;
