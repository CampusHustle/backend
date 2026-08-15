import { Availability } from '../models/Availability.js';
import { AppError } from '../middleware/errorHandler.js';

const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * Validates time string format and sequence.
 * @param {string} startTime
 * @param {string} endTime
 */
function validateTimeRange(startTime, endTime) {
  if (!TIME_REGEX.test(startTime) || !TIME_REGEX.test(endTime)) {
    throw new AppError('Start time and end time must be in HH:MM 24-hour format.', 400, 'VALIDATION_ERROR');
  }

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes >= endMinutes) {
    throw new AppError('Start time must be strictly before end time.', 400, 'INVALID_TIME_RANGE');
  }
}

/**
 * Creates a new weekly availability slot for a tutor.
 * Satisfies FR-5.
 * @param {string} tutorId
 * @param {Object} slotData
 */
export async function createSlot(tutorId, { dayOfWeek, startTime, endTime }) {
  if (!dayOfWeek || !VALID_DAYS.includes(dayOfWeek)) {
    throw new AppError(`Day of week must be one of: ${VALID_DAYS.join(', ')}.`, 400, 'VALIDATION_ERROR');
  }

  validateTimeRange(startTime, endTime);

  // Check for duplicate slot on the same day and time
  const existingSlot = await Availability.findOne({
    tutorId,
    dayOfWeek,
    startTime,
    endTime
  });

  if (existingSlot) {
    throw new AppError('An availability slot for this day and time already exists.', 409, 'SLOT_EXISTS');
  }

  const slot = new Availability({
    tutorId,
    dayOfWeek,
    startTime,
    endTime,
    isBooked: false
  });

  await slot.save();
  return slot;
}

/**
 * Retrieves a tutor's availability slots.
 * @param {string} tutorId
 * @param {boolean} [onlyOpen=true] - Only return unbooked slots if true
 */
export async function getTutorSlots(tutorId, onlyOpen = true) {
  if (!tutorId) {
    throw new AppError('Tutor ID is required.', 400, 'VALIDATION_ERROR');
  }

  const query = { tutorId };
  if (onlyOpen) {
    query.isBooked = false;
  }

  const slots = await Availability.find(query).sort({ dayOfWeek: 1, startTime: 1 });
  return slots;
}

/**
 * Updates an availability slot (ownership checked).
 * Mitigates Tampering (STRIDE) by verifying tutor ownership.
 * @param {string} slotId
 * @param {string} tutorId
 * @param {Object} updates
 */
export async function updateSlot(slotId, tutorId, updates) {
  const slot = await Availability.findById(slotId);
  if (!slot) {
    throw new AppError('Availability slot not found.', 404, 'NOT_FOUND');
  }

  // Ownership verification
  if (slot.tutorId.toString() !== tutorId.toString()) {
    throw new AppError('Forbidden. You do not own this availability slot.', 403, 'FORBIDDEN');
  }

  if (slot.isBooked) {
    throw new AppError('Cannot modify an availability slot that is already booked.', 400, 'SLOT_ALREADY_BOOKED');
  }

  if (updates.dayOfWeek) {
    if (!VALID_DAYS.includes(updates.dayOfWeek)) {
      throw new AppError(`Day of week must be one of: ${VALID_DAYS.join(', ')}.`, 400, 'VALIDATION_ERROR');
    }
    slot.dayOfWeek = updates.dayOfWeek;
  }

  const newStart = updates.startTime || slot.startTime;
  const newEnd = updates.endTime || slot.endTime;
  validateTimeRange(newStart, newEnd);

  slot.startTime = newStart;
  slot.endTime = newEnd;

  await slot.save();
  return slot;
}

/**
 * Deletes an availability slot (ownership checked).
 * Mitigates Tampering (STRIDE).
 * @param {string} slotId
 * @param {string} tutorId
 */
export async function deleteSlot(slotId, tutorId) {
  const slot = await Availability.findById(slotId);
  if (!slot) {
    throw new AppError('Availability slot not found.', 404, 'NOT_FOUND');
  }

  // Ownership verification
  if (slot.tutorId.toString() !== tutorId.toString()) {
    throw new AppError('Forbidden. You do not own this availability slot.', 403, 'FORBIDDEN');
  }

  if (slot.isBooked) {
    throw new AppError('Cannot delete an availability slot that is currently booked.', 400, 'SLOT_ALREADY_BOOKED');
  }

  await Availability.findByIdAndDelete(slotId);
  return { message: 'Availability slot deleted successfully.' };
}
