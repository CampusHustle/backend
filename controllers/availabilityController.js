import { Availability } from "../models/Availability.js";
import { AppError } from "../middleware/errorHandler.js";

/**
 * @desc Create a new availability slot
 * @route POST /api/availability
 * @access Private (Tutor)
 */
export const createAvailability = async (req, res, next) => {
  try {
    const { dayOfWeek, startTime, endTime } = req.body;
    const tutorId = req.user._id;

    if (!dayOfWeek || !startTime || !endTime) {
      throw new AppError(
        "dayOfWeek, startTime, and endTime are required.",
        400,
        "MISSING_REQUIRED_FIELDS",
      );
    }

    // Check for exact duplicate slot for this tutor
    const existingSlot = await Availability.findOne({
      tutorId,
      dayOfWeek,
      startTime,
      endTime,
    });

    if (existingSlot) {
      throw new AppError(
        "An availability slot with the exact same time already exists.",
        400,
        "DUPLICATE_SLOT",
      );
    }

    const newSlot = new Availability({
      tutorId,
      dayOfWeek,
      startTime,
      endTime,
      isBooked: false,
    });

    await newSlot.save();

    res.status(201).json({
      success: true,
      message: "Availability slot created successfully.",
      data: newSlot,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get available slots for a specific tutor
 * @route GET /api/availability/tutor/:tutorId
 * @access Public / Authenticated
 */
export const getTutorAvailability = async (req, res, next) => {
  try {
    const { tutorId } = req.params;
    const { isBooked } = req.query;

    const filter = { tutorId };
    if (isBooked !== undefined) {
      filter.isBooked = isBooked === "true";
    }

    const slots = await Availability.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: slots.length,
      data: slots,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get logged-in tutor's own availability slots
 * @route GET /api/availability/me
 * @access Private (Tutor)
 */
export const getMyAvailability = async (req, res, next) => {
  try {
    const tutorId = req.user._id;
    const slots = await Availability.find({ tutorId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: slots.length,
      data: slots,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Update an existing availability slot
 * @route PUT /api/availability/:id
 * @access Private (Slot Owner Tutor)
 */
export const updateAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { dayOfWeek, startTime, endTime } = req.body;
    const userId = req.user._id;

    const slot = await Availability.findById(id);

    if (!slot) {
      throw new AppError("Availability slot not found.", 404, "NOT_FOUND");
    }

    if (slot.tutorId.toString() !== userId.toString()) {
      throw new AppError(
        "Forbidden. You can only update your own availability slots.",
        403,
        "FORBIDDEN",
      );
    }

    if (slot.isBooked) {
      throw new AppError(
        "Cannot update an availability slot that is already booked.",
        400,
        "SLOT_BOOKED",
      );
    }

    if (dayOfWeek) slot.dayOfWeek = dayOfWeek;
    if (startTime) slot.startTime = startTime;
    if (endTime) slot.endTime = endTime;

    await slot.save();

    res.status(200).json({
      success: true,
      message: "Availability slot updated successfully.",
      data: slot,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Delete an availability slot, optional endpoint? as we have cancell functionality in our booking
 * @route DELETE /api/availability/:id
 * @access Private (Slot Owner Tutor)
 */
export const deleteAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const slot = await Availability.findById(id);

    if (!slot) {
      throw new AppError("Availability slot not found.", 404, "NOT_FOUND");
    }

    if (slot.tutorId.toString() !== userId.toString()) {
      throw new AppError(
        "Forbidden. You can only delete your own availability slots.",
        403,
        "FORBIDDEN",
      );
    }

    if (slot.isBooked) {
      throw new AppError(
        "Cannot delete an availability slot that is already booked.",
        400,
        "SLOT_BOOKED",
      );
    }

    await slot.deleteOne();

    res.status(200).json({
      success: true,
      message: "Availability slot deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};
