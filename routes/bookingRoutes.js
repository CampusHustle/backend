import express from "express";

import {
  createBooking,
  updateBookingStatus,
  getUserBookings,
} from "../controllers/bookingController.js";

const router = express.Router();

router.post("/", createBooking);
router.patch("/:bookingId", updateBookingStatus);
router.get("/user", getUserBookings);

export default router;
