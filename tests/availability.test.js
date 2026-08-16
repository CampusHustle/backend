import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Availability from '../models/Availability.js';
import {
  createAvailability,
  getTutorAvailability,
  getMyAvailability,
  updateAvailability,
  deleteAvailability,
} from '../controllers/availabilityController.js';

test('Availability Schema - validates required fields and valid days of week', () => {
  const tutorId = new mongoose.Types.ObjectId();
  const validSlot = new Availability({
    tutorId,
    dayOfWeek: 'Monday',
    startTime: '09:00',
    endTime: '10:30',
  });

  const err = validSlot.validateSync();
  assert.equal(err, undefined);
});

test('Availability Schema - rejects invalid dayOfWeek enum', () => {
  const tutorId = new mongoose.Types.ObjectId();
  const invalidSlot = new Availability({
    tutorId,
    dayOfWeek: 'Funday',
    startTime: '09:00',
    endTime: '10:30',
  });

  const err = invalidSlot.validateSync();
  assert.notEqual(err, undefined);
  assert.ok(err.errors.dayOfWeek);
});

test('Availability Schema - rejects invalid time formats', () => {
  const tutorId = new mongoose.Types.ObjectId();
  const invalidTimeSlot = new Availability({
    tutorId,
    dayOfWeek: 'Tuesday',
    startTime: '9 AM',
    endTime: '10:00',
  });

  const err = invalidTimeSlot.validateSync();
  assert.notEqual(err, undefined);
  assert.ok(err.errors.startTime);
});

test('Availability Schema - pre-validate rule rejects endTime <= startTime', () => {
  const tutorId = new mongoose.Types.ObjectId();
  const invertedSlot = new Availability({
    tutorId,
    dayOfWeek: 'Wednesday',
    startTime: '14:00',
    endTime: '13:00',
  });

  const err = invertedSlot.validateSync();
  assert.notEqual(err, undefined);
  assert.ok(err.errors.endTime);
});

test('Availability Controller - export structure verification', () => {
  assert.equal(typeof createAvailability, 'function');
  assert.equal(typeof getTutorAvailability, 'function');
  assert.equal(typeof getMyAvailability, 'function');
  assert.equal(typeof updateAvailability, 'function');
  assert.equal(typeof deleteAvailability, 'function');
});

test('Availability Controller - createAvailability validation for missing fields', async () => {
  const req = {
    user: { _id: new mongoose.Types.ObjectId() },
    body: { dayOfWeek: 'Monday' }, // missing startTime & endTime
  };
  const res = {};
  let capturedError = null;

  await createAvailability(req, res, (err) => {
    capturedError = err;
  });

  assert.notEqual(capturedError, null);
  assert.equal(capturedError.statusCode, 400);
  assert.equal(capturedError.code, 'MISSING_REQUIRED_FIELDS');
});
