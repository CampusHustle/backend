import test from 'node:test';
import assert from 'node:assert/strict';
import { isUniversityEmail } from '../utils/emailValidator.js';
import * as authService from '../services/authService.js';

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
