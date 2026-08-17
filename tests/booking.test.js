import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import {
  createBooking,
  updateBookingStatus,
  getUserBookings,
  getBookingById,
} from "../controllers/bookingController.js";

test("Booking Schema - validates required fields and default status", () => {
  const studentId = new mongoose.Types.ObjectId();
  const tutorId = new mongoose.Types.ObjectId();
  const availabilityId = new mongoose.Types.ObjectId();

  const validBooking = new Booking({
    studentId,
    tutorId,
    availabilityId,
  });

  const err = validBooking.validateSync();
  assert.equal(err, undefined);
  assert.equal(validBooking.status, "pending");
});

test("Booking Schema - validates status enum including declined", () => {
  const studentId = new mongoose.Types.ObjectId();
  const tutorId = new mongoose.Types.ObjectId();
  const availabilityId = new mongoose.Types.ObjectId();

  const validStatuses = [
    "pending",
    "confirmed",
    "declined",
    "cancelled",
    "completed",
  ];

  validStatuses.forEach((status) => {
    const booking = new Booking({
      studentId,
      tutorId,
      availabilityId,
      status,
    });
    const err = booking.validateSync();
    assert.equal(err, undefined, `Status '${status}' should be valid`);
  });
});

test("Booking Schema - rejects invalid status enum values", () => {
  const studentId = new mongoose.Types.ObjectId();
  const tutorId = new mongoose.Types.ObjectId();
  const availabilityId = new mongoose.Types.ObjectId();

  const invalidBooking = new Booking({
    studentId,
    tutorId,
    availabilityId,
    status: "approved", // Invalid enum
  });

  const err = invalidBooking.validateSync();
  assert.notEqual(err, undefined);
  assert.ok(err.errors.status);
});

test("Booking Controller - export structure verification", () => {
  assert.equal(typeof createBooking, "function");
  assert.equal(typeof updateBookingStatus, "function");
  assert.equal(typeof getUserBookings, "function");
  assert.equal(typeof getBookingById, "function");
});

test("Booking Controller - createBooking validation for missing availabilityId", async () => {
  const req = {
    user: { _id: new mongoose.Types.ObjectId() },
    body: {},
  };
  const res = {};
  let capturedError = null;

  await createBooking(req, res, (err) => {
    capturedError = err;
  });

  assert.notEqual(capturedError, null);
  assert.equal(capturedError.statusCode, 400);
  assert.equal(capturedError.code, "MISSING_REQUIRED_FIELDS");
});

test("Booking Controller - updateBookingStatus rejects invalid status string", async () => {
  const req = {
    params: { id: new mongoose.Types.ObjectId().toString() },
    user: { _id: new mongoose.Types.ObjectId() },
    body: { status: "invalid_status_name" },
  };
  const res = {};
  let capturedError = null;

  await updateBookingStatus(req, res, (err) => {
    capturedError = err;
  });

  assert.notEqual(capturedError, null);
  assert.equal(capturedError.statusCode, 400);
  assert.equal(capturedError.code, "INVALID_STATUS");
});
