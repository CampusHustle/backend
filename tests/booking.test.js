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

test("Booking Controller - creates booking and verifies persistence with studentId and tutorId", async () => {
  const studentId = new mongoose.Types.ObjectId();
  const tutorId = new mongoose.Types.ObjectId();
  const availabilityId = new mongoose.Types.ObjectId();

  const slot = {
    _id: availabilityId,
    tutorId,
    dayOfWeek: "Monday",
    startTime: "10:00",
    endTime: "11:00",
    isBooked: false,
  };

  const origFindById = mongoose.model("Availability").findById;
  const origFindOne = Booking.findOne;
  const origSave = Booking.prototype.save;

  mongoose.model("Availability").findById = async (id) => {
    if (id.toString() === availabilityId.toString()) return slot;
    return null;
  };

  Booking.findOne = async () => null;

  let savedDoc = null;
  Booking.prototype.save = async function () {
    savedDoc = this;
    return this;
  };

  const req = {
    user: { _id: studentId },
    body: { availabilityId: availabilityId.toString() },
  };

  let responseData = null;
  const res = {
    status(code) {
      assert.equal(code, 201);
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };

  try {
    await createBooking(req, res, (err) => {
      if (err) throw err;
    });

    assert.ok(savedDoc, "Booking document must be saved to DB");
    assert.equal(savedDoc.studentId.toString(), studentId.toString());
    assert.equal(savedDoc.tutorId.toString(), tutorId.toString());
    assert.equal(savedDoc.availabilityId.toString(), availabilityId.toString());
    assert.equal(savedDoc.status, "pending");
    assert.equal(responseData.success, true);
  } finally {
    mongoose.model("Availability").findById = origFindById;
    Booking.findOne = origFindOne;
    Booking.prototype.save = origSave;
  }
});

test("Booking Controller - getUserBookings filters incoming requests for tutor and outgoing for student", async () => {
  const studentId = new mongoose.Types.ObjectId();
  const tutorId = new mongoose.Types.ObjectId();

  const origFind = Booking.find;

  let capturedTutorFilter = null;
  let capturedStudentFilter = null;

  Booking.find = function (filter) {
    if (filter.tutorId) capturedTutorFilter = filter;
    if (filter.studentId) capturedStudentFilter = filter;

    return {
      populate() {
        return this;
      },
      sort() {
        return [
          {
            _id: new mongoose.Types.ObjectId(),
            studentId,
            tutorId,
            status: "pending",
          },
        ];
      },
    };
  };

  try {
    // 1. Tutor incoming requests query
    const reqTutor = { user: { _id: tutorId }, query: { role: "tutor" } };
    let tutorResData = null;
    const resTutor = {
      status(code) {
        assert.equal(code, 200);
        return this;
      },
      json(data) {
        tutorResData = data;
        return this;
      },
    };
    await getUserBookings(reqTutor, resTutor, () => {});
    assert.equal(capturedTutorFilter.tutorId.toString(), tutorId.toString());
    assert.equal(tutorResData.count, 1);

    // 2. Student outgoing requests query
    const reqStudent = { user: { _id: studentId }, query: { role: "student" } };
    let studentResData = null;
    const resStudent = {
      status(code) {
        assert.equal(code, 200);
        return this;
      },
      json(data) {
        studentResData = data;
        return this;
      },
    };
    await getUserBookings(reqStudent, resStudent, () => {});
    assert.equal(capturedStudentFilter.studentId.toString(), studentId.toString());
    assert.equal(studentResData.count, 1);
  } finally {
    Booking.find = origFind;
  }
});

