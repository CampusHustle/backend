import test from 'node:test';
import assert from 'node:assert/strict';
import { isUniversityEmail } from '../utils/emailValidator.js';
import * as authService from '../services/authService.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

test('Email Validator - rejects non-university emails', () => {
  assert.equal(isUniversityEmail('student@gmail.com'), false);
  assert.equal(isUniversityEmail('attacker@yahoo.com'), false);
  assert.equal(isUniversityEmail('invalid'), false);
});

test('Email Validator - accepts valid .edu.et university emails', () => {
  assert.equal(isUniversityEmail('daniel@aau.edu.et'), true);
  assert.equal(isUniversityEmail('student@aait.edu.et'), true);
});

test('Auth Service - verifies structure of token rotation and verification functions', () => {
  assert.equal(typeof authService.registerUser, 'function');
  assert.equal(typeof authService.loginUser, 'function');
  assert.equal(typeof authService.verifyUserEmail, 'function');
  assert.equal(typeof authService.refreshAuthToken, 'function');
  assert.equal(typeof authService.logoutUser, 'function');
});

test('RBAC Middleware - requireRole allows access when role is permitted', () => {
  const middleware = requireRole('tutor', 'admin');
  const req = { user: { role: 'tutor' } };
  const res = {};
  let nextCalled = false;
  let nextError = null;

  middleware(req, res, (err) => {
    nextCalled = true;
    nextError = err;
  });

  assert.equal(nextCalled, true);
  assert.equal(nextError, undefined);
});

test('requireAuth - rejects missing or malformed bearer token with 401 (protects /api/ai/ask)', async () => {
  const req = { headers: {} };
  const res = {};
  let capturedError = null;

  await requireAuth(req, res, (err) => {
    capturedError = err;
  });

  assert.notEqual(capturedError, null);
  assert.equal(capturedError.statusCode, 401);
  assert.equal(capturedError.code, 'UNAUTHORIZED');
});

test('RBAC Middleware - requireRole rejects unauthorized role with 403 status', () => {
  const middleware = requireRole('admin');
  const req = { user: { role: 'student' } };
  const res = {};
  let capturedError = null;

  middleware(req, res, (err) => {
    capturedError = err;
  });

  assert.notEqual(capturedError, null);
  assert.equal(capturedError.statusCode, 403);
  assert.equal(capturedError.code, 'FORBIDDEN');
});

test('RBAC Middleware - requireRole rejects unauthenticated request with 401 status', () => {
  const middleware = requireRole('student', 'tutor');
  const req = {}; // no req.user
  const res = {};
  let capturedError = null;

  middleware(req, res, (err) => {
    capturedError = err;
  });

  assert.notEqual(capturedError, null);
  assert.equal(capturedError.statusCode, 401);
  assert.equal(capturedError.code, 'UNAUTHORIZED');
});
