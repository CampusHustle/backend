import test from 'node:test';
import assert from 'node:assert/strict';
import { isUniversityEmail } from '../utils/emailValidator.js';
import * as authService from '../services/authService.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

test('Email Validator - rejects non-university emails', () => {
  assert.equal(isUniversityEmail('student@gmail.com'), false);
  assert.equal(isUniversityEmail('attacker@yahoo.com'), false);
  assert.equal(isUniversityEmail('invalid'), false);
  assert.equal(isUniversityEmail(''), false);
  assert.equal(isUniversityEmail(null), false);
});

test('Email Validator - rejects emails that look like .edu.et but are not', () => {
  // Must end exactly with .edu.et — suffix spoofing should fail
  assert.equal(isUniversityEmail('student@aau.edu.et.evil.com'), false);
  assert.equal(isUniversityEmail('student@edu.et'), false);
});

test('Email Validator - accepts valid .edu.et university emails', () => {
  assert.equal(isUniversityEmail('daniel@aau.edu.et'), true);
  assert.equal(isUniversityEmail('student@aait.edu.et'), true);
  assert.equal(isUniversityEmail('user.name+tag@insa.edu.et'), true);
});

// ─── Auth Service ─────────────────────────────────────────────────────────────

test('Auth Service - all required exported functions exist', () => {
  assert.equal(typeof authService.registerUser, 'function');
  assert.equal(typeof authService.loginUser, 'function');
  assert.equal(typeof authService.verifyUserEmail, 'function');
  assert.equal(typeof authService.resendVerificationEmail, 'function');
  assert.equal(typeof authService.refreshAuthToken, 'function');
  assert.equal(typeof authService.logoutUser, 'function');
});

// ─── RBAC Middleware ──────────────────────────────────────────────────────────

test('RBAC Middleware - requireRole allows access when role is permitted', () => {
  const middleware = requireRole('tutor', 'admin');
  const req = { user: { role: 'tutor' } };
  let nextCalled = false;
  let nextError = null;

  middleware(req, {}, (err) => {
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
  let capturedError = null;

  middleware(req, {}, (err) => { capturedError = err; });

  assert.notEqual(capturedError, null);
  assert.equal(capturedError.statusCode, 403);
  assert.equal(capturedError.code, 'FORBIDDEN');
});

test('RBAC Middleware - requireRole rejects unauthenticated request with 401', () => {
  const middleware = requireRole('student', 'tutor');
  const req = {}; // no req.user
  let capturedError = null;

  middleware(req, {}, (err) => { capturedError = err; });

  assert.notEqual(capturedError, null);
  assert.equal(capturedError.statusCode, 401);
  assert.equal(capturedError.code, 'UNAUTHORIZED');
});

test('RBAC Middleware - requireVerifiedEmail rejects unverified user with 403', () => {
  const req = { user: { isEmailVerified: false } };
  let capturedError = null;

  requireVerifiedEmail(req, {}, (err) => { capturedError = err; });

  assert.notEqual(capturedError, null);
  assert.equal(capturedError.statusCode, 403);
  assert.equal(capturedError.code, 'EMAIL_NOT_VERIFIED');
});

test('RBAC Middleware - requireVerifiedEmail allows verified user', () => {
  const req = { user: { isEmailVerified: true } };
  let nextCalled = false;

  requireVerifiedEmail(req, {}, (err) => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});
