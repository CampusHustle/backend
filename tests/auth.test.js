import test from 'node:test';
import assert from 'node:assert/strict';
import { isUniversityEmail } from '../utils/emailValidator.js';

test('Email Validator - rejects non-university emails', () => {
  assert.equal(isUniversityEmail('student@gmail.com'), false);
  assert.equal(isUniversityEmail('attacker@yahoo.com'), false);
  assert.equal(isUniversityEmail('invalid'), false);
});

test('Email Validator - accepts valid .edu.et university emails', () => {
  assert.equal(isUniversityEmail('daniel@aau.edu.et'), true);
  assert.equal(isUniversityEmail('student@aait.edu.et'), true);
});
