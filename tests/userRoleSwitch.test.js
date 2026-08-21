import test from 'node:test';
import assert from 'node:assert/strict';
import { updateUserRole } from '../controllers/userController.js';

test('updateUserRole - validates role input', async () => {
  let errCaptured = null;
  const req = { body: { role: 'invalid_role' }, user: { _id: 'user123', role: 'tutor' } };
  const res = {};
  const next = (err) => {
    errCaptured = err;
  };

  await updateUserRole(req, res, next);
  assert.notEqual(errCaptured, null);
  assert.equal(errCaptured.statusCode, 400);
});

test('updateUserRole - student to tutor transition succeeds', async () => {
  let saved = false;
  const mockUser = {
    _id: 'user123',
    role: 'student',
    save: async () => {
      saved = true;
    },
  };

  const req = { body: { role: 'tutor' }, user: mockUser };
  let responseData = null;
  let responseStatus = null;

  const res = {
    status: (code) => {
      responseStatus = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    },
  };

  await updateUserRole(req, res, () => {});

  assert.equal(responseStatus, 200);
  assert.equal(responseData.success, true);
  assert.equal(mockUser.role, 'tutor');
  assert.equal(saved, true);
});
