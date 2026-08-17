import express from 'express';
import {
  createBooking,
  updateBookingStatus,
  getUserBookings,
  getBookingById,
} from '../controllers/bookingController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.post('/', createBooking);
router.get('/me', getUserBookings);
router.get('/:id', getBookingById);
router.patch('/:id/status', updateBookingStatus);
router.patch('/:bookingId', updateBookingStatus);

export default router;
