import mongoose from 'mongoose';
import { Booking } from '../models/Booking.js';
import { Availability } from '../models/Availability.js';
import { AppError } from '../middleware/errorHandler.js';
import { createNotification } from '../services/notificationService.js';

/**
 * @desc Request a new booking for an open availability slot
 * @route POST /api/bookings
 * @access Private (Student)
 */
export const createBooking = async (req, res, next) => {
  try {
    const { availabilityId, tutorId, dayOfWeek, startTime, endTime, day, time } = req.body;
    const studentId = req.user._id;

    let slot;
    if (availabilityId && mongoose.Types.ObjectId.isValid(availabilityId)) {
      slot = await Availability.findById(availabilityId);
    }

    if (!slot && tutorId) {
      const dayMap = {
        Mon: 'Monday',
        Tue: 'Tuesday',
        Wed: 'Wednesday',
        Thu: 'Thursday',
        Fri: 'Friday',
        Sat: 'Saturday',
        Sun: 'Sunday',
      };
      const rawDay = dayOfWeek || day || 'Monday';
      const selectedDay = dayMap[rawDay] || rawDay;

      const convertTime = (t) => {
        if (!t) return '09:00';
        if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(t)) return t;
        const match = t.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (match) {
          let h = parseInt(match[1], 10);
          const m = match[2];
          const ampm = match[3]?.toUpperCase();
          if (ampm === 'PM' && h < 12) h += 12;
          if (ampm === 'AM' && h === 12) h = 0;
          return `${String(h).padStart(2, '0')}:${m}`;
        }
        return '09:00';
      };

      const sTime = startTime ? convertTime(startTime) : (time ? convertTime(time) : '09:00');
      const [sh, sm] = sTime.split(':').map(Number);
      const eTime = endTime ? convertTime(endTime) : `${String((sh + 1) % 24).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;

      slot = await Availability.findOne({ tutorId, dayOfWeek: selectedDay, startTime: sTime });
      if (!slot) {
        slot = new Availability({ tutorId, dayOfWeek: selectedDay, startTime: sTime, endTime: eTime, isBooked: false });
        await slot.save();
      }
    } else {
      throw new AppError('availabilityId or tutorId is required.', 400, 'MISSING_REQUIRED_FIELDS');
    }

    if (!slot) {
      throw new AppError('Availability slot not found.', 404, 'NOT_FOUND');
    }

    if (slot.isBooked) {
      throw new AppError('This availability slot is no longer available.', 400, 'SLOT_NOT_AVAILABLE');
    }

    if (slot.tutorId.toString() === studentId.toString()) {
      throw new AppError('Cannot book your own availability slot.', 400, 'SELF_BOOKING_NOT_ALLOWED');
    }

    // Check if student already has a pending or confirmed booking for this slot
    const existingBooking = await Booking.findOne({
      studentId,
      availabilityId: slot._id,
      status: { $in: ['pending', 'confirmed'] },
    });

    if (existingBooking) {
      throw new AppError('You already have an active booking for this availability slot.', 400, 'DUPLICATE_BOOKING');
    }

    const newBooking = new Booking({
      studentId,
      tutorId: slot.tutorId,
      availabilityId: slot._id,
      status: 'pending',
    });

    await newBooking.save();

    // Trigger notification for tutor (FR-14)
    await createNotification({
      recipientId: slot.tutorId,
      senderId: studentId,
      type: 'booking_request',
      title: 'New Booking Request',
      message: 'A student requested a tutoring session.',
      referenceId: newBooking._id,
      referenceType: 'booking'
    });

    res.status(201).json({
      success: true,
      message: 'Booking request submitted successfully.',
      data: newBooking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Update booking status with strict state machine and authorization controls
 * @route PATCH /api/bookings/:id/status (or /api/bookings/:id)
 * @access Private (Booking Student / Tutor)
 */
export const updateBookingStatus = async (req, res, next) => {
  try {
    const bookingId = req.params.id || req.params.bookingId;
    const { status } = req.body;
    const userId = req.user._id;

    const validStatuses = ['pending', 'confirmed', 'declined', 'cancelled', 'completed'];
    if (!status || !validStatuses.includes(status)) {
      throw new AppError(
        `Invalid status transition value. Allowed statuses: ${validStatuses.join(', ')}.`,
        400,
        'INVALID_STATUS'
      );
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      throw new AppError('Booking not found.', 404, 'NOT_FOUND');
    }

    const isStudent = booking.studentId.toString() === userId.toString();
    const isTutor = booking.tutorId.toString() === userId.toString();

    if (!isStudent && !isTutor) {
      throw new AppError('Forbidden. You are not authorized to transition this booking.', 403, 'FORBIDDEN');
    }

    // Reject transitions from terminal states
    if (['declined', 'cancelled', 'completed'].includes(booking.status)) {
      throw new AppError(
        `Cannot transition booking status from terminal state '${booking.status}'.`,
        400,
        'INVALID_TRANSITION'
      );
    }

    // State machine logic
    if (booking.status === 'pending') {
      if (status === 'confirmed') {
        if (!isTutor) {
          throw new AppError('Forbidden. Only the tutor can confirm a booking request.', 403, 'FORBIDDEN');
        }
        // Mark availability slot as booked
        await Availability.findByIdAndUpdate(booking.availabilityId, { isBooked: true });
      } else if (status === 'declined') {
        if (!isTutor) {
          throw new AppError('Forbidden. Only the tutor can decline a booking request.', 403, 'FORBIDDEN');
        }
        // Free up availability slot on decline
        await Availability.findByIdAndUpdate(booking.availabilityId, { isBooked: false });
      } else if (status === 'cancelled') {
        // Both student and tutor can cancel a pending booking
      } else if (status === 'completed') {
        throw new AppError('Cannot complete a booking request before it has been confirmed.', 400, 'INVALID_TRANSITION');
      }
    } else if (booking.status === 'confirmed') {
      if (status === 'completed') {
        // Both student and tutor can mark a confirmed session as completed
      } else if (status === 'cancelled') {
        // Cancelled from confirmed: free up availability slot
        await Availability.findByIdAndUpdate(booking.availabilityId, { isBooked: false });
      } else if (status === 'confirmed') {
        throw new AppError('Booking is already confirmed.', 400, 'INVALID_TRANSITION');
      } else if (status === 'declined') {
        throw new AppError('Cannot decline an already confirmed booking. Use cancellation instead.', 400, 'INVALID_TRANSITION');
      }
    }

    booking.status = status;
    await booking.save();

    // Trigger notification for the other participant (FR-14)
    const recipientId = isStudent ? booking.tutorId : booking.studentId;
    const notificationTypeMap = {
      confirmed: { type: 'booking_accepted', title: 'Booking Confirmed', message: 'Your tutoring session booking has been confirmed.' },
      declined: { type: 'booking_declined', title: 'Booking Declined', message: 'Your tutoring session booking request was declined.' },
      cancelled: { type: 'booking_cancelled', title: 'Booking Cancelled', message: 'A tutoring session booking has been cancelled.' },
      completed: { type: 'booking_completed', title: 'Booking Completed', message: 'Your tutoring session has been marked as completed.' }
    };

    const notifInfo = notificationTypeMap[status];
    if (notifInfo) {
      await createNotification({
        recipientId,
        senderId: userId,
        type: notifInfo.type,
        title: notifInfo.title,
        message: notifInfo.message,
        referenceId: booking._id,
        referenceType: 'booking'
      });
    }

    res.status(200).json({
      success: true,
      message: `Booking status updated to '${status}'.`,
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};


/**
 * @desc Get all bookings for the logged-in user (as student or tutor)
 * @route GET /api/bookings/me
 * @access Private
 */
export const getUserBookings = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { status, role, type } = req.query;

    let filter = {};
    if (role === 'student' || type === 'outgoing') {
      filter.studentId = userId;
    } else if (role === 'tutor' || type === 'incoming') {
      filter.tutorId = userId;
    } else {
      filter.$or = [{ studentId: userId }, { tutorId: userId }];
    }

    if (status) {
      filter.status = status;
    }

    const bookings = await Booking.find(filter)
      .populate('availabilityId')
      .populate('tutorId', 'name email department profilePicUrl')
      .populate('studentId', 'name email department profilePicUrl')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get booking details by ID
 * @route GET /api/bookings/:id
 * @access Private (Booking Participant)
 */
export const getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const booking = await Booking.findById(id)
      .populate('availabilityId')
      .populate('tutorId', 'name email department profilePicUrl')
      .populate('studentId', 'name email department profilePicUrl');

    if (!booking) {
      throw new AppError('Booking not found.', 404, 'NOT_FOUND');
    }

    const isStudent = booking.studentId._id.toString() === userId.toString();
    const isTutor = booking.tutorId._id.toString() === userId.toString();

    if (!isStudent && !isTutor) {
      throw new AppError('Forbidden. You are not authorized to view this booking.', 403, 'FORBIDDEN');
    }

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};
