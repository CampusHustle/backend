import Booking from "../models/booking";
import { Availability } from "../models/Availability.js";

export const createBooking = async (req, res) => {
  try {
    const { availabilityId, tutorId, studentId } = req.body;

    const slot = await Availability.findById(availabilityId);

    if (!slot || slot.isBooked) {
      return res
        .status(400)
        .json({ success: false, message: "Slot not available" });
    }

    const newBooking = new Booking({
      studentId,
      tutorId,
      availabilityId,
    });
    await newBooking.save();
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

export const updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;
    const validStatuses = ["confirmed", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status transition value" });
    }

    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      { status },
      { new: true },
    );

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    // so it is only when the tutor accept the booking the avaliablity slot be closed
    const booking = await Booking.findById(id);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    // If a tutor declines/cancels or student cancels, free up the availability slot
    if (status === "cancelled") {
      await Availability.findByIdAndUpdate(booking.availabilityId, {
        isBooked: false,
      });
    }
    if (status === "confirmed") {
      await Availability.findByIdAndUpdate(booking.availabilityId, {
        isBooked: true,
      });
    }

    booking.status = status;
    await booking.save();

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
//works both for tutors and students
export const getUserBookings = async (req, res) => {
  try {
    // assuming req.user contains the logged-in user's ID and role from auth middleware
    const userId = req.user?._id || req.query.userId; // fallback query param for testing

    const bookings = await Booking.find({
      $or: [{ studentId: userId }, { tutorId: userId }],
    }).populate("availabilityId");

    res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
