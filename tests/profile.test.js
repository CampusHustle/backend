import test from 'node:test';
import assert from 'node:assert/strict';
import { ALLOWED_SKILL_TAGS } from '../utils/skillTags.js';
import * as userService from '../services/userService.js';

// ─── Skill Tags List ──────────────────────────────────────────────────────────

test('skillTags - ALLOWED_SKILL_TAGS is a non-empty array of lowercase strings', () => {
  assert.ok(Array.isArray(ALLOWED_SKILL_TAGS));
  assert.ok(ALLOWED_SKILL_TAGS.length > 0);
  for (const tag of ALLOWED_SKILL_TAGS) {
    assert.equal(typeof tag, 'string', `tag "${tag}" should be a string`);
    assert.equal(tag, tag.toLowerCase(), `tag "${tag}" should be lowercase`);
    assert.ok(tag.trim().length > 0, `tag should not be blank`);
  }
});

test('skillTags - contains expected core subjects', () => {
  assert.ok(ALLOWED_SKILL_TAGS.includes('mathematics'));
  assert.ok(ALLOWED_SKILL_TAGS.includes('python'));
  assert.ok(ALLOWED_SKILL_TAGS.includes('data structures'));
  assert.ok(ALLOWED_SKILL_TAGS.includes('english'));
  assert.ok(ALLOWED_SKILL_TAGS.includes('economics'));
});

test('skillTags - no duplicate entries in the canonical list', () => {
  const unique = new Set(ALLOWED_SKILL_TAGS);
  assert.equal(unique.size, ALLOWED_SKILL_TAGS.length, 'Duplicate tags found in ALLOWED_SKILL_TAGS');
});

// ─── updateProfile (FR-2 / FR-3 validation) ──────────────────────────────────

test('updateProfile - service function is exported', () => {
  assert.equal(typeof userService.updateProfile, 'function');
  assert.equal(typeof userService.getProfile, 'function');
  assert.equal(typeof userService.getPublicProfile, 'function');
  assert.equal(typeof userService.searchTutors, 'function');
});

test('updateProfile - rejects empty update body', async () => {
  // We can't hit the DB in unit tests, but we can verify validation fires
  // before the DB call by passing an object with only invalid fields
  await assert.rejects(
    () => userService.updateProfile('507f1f77bcf86cd799439011', {}),
    (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      return true;
    }
  );
});

test('updateProfile - rejects blank name', async () => {
  await assert.rejects(
    () => userService.updateProfile('507f1f77bcf86cd799439011', { name: '   ' }),
    (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      assert.ok(err.message.toLowerCase().includes('name'));
      return true;
    }
  );
});

test('updateProfile - rejects bio over 500 chars', async () => {
  await assert.rejects(
    () => userService.updateProfile('507f1f77bcf86cd799439011', { bio: 'x'.repeat(501) }),
    (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      assert.ok(err.message.toLowerCase().includes('bio'));
      return true;
    }
  );
});

test('updateProfile - rejects year out of range', async () => {
  await assert.rejects(
    () => userService.updateProfile('507f1f77bcf86cd799439011', { year: 9 }),
    (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      assert.ok(err.message.toLowerCase().includes('year'));
      return true;
    }
  );
});

test('updateProfile - rejects negative hourlyRate', async () => {
  await assert.rejects(
    () => userService.updateProfile('507f1f77bcf86cd799439011', { hourlyRate: -5 }),
    (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      assert.ok(err.message.toLowerCase().includes('hourly rate'));
      return true;
    }
  );
});

test('updateProfile - rejects hourlyRate over 10000', async () => {
  await assert.rejects(
    () => userService.updateProfile('507f1f77bcf86cd799439011', { hourlyRate: 99999 }),
    (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      return true;
    }
  );
});

test('updateProfile - rejects invalid profilePicUrl', async () => {
  await assert.rejects(
    () => userService.updateProfile('507f1f77bcf86cd799439011', { profilePicUrl: 'not-a-url' }),
    (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      assert.ok(err.message.toLowerCase().includes('url'));
      return true;
    }
  );
});

test('updateProfile - rejects admin role self-assignment', async () => {
  await assert.rejects(
    () => userService.updateProfile('507f1f77bcf86cd799439011', { role: 'admin' }),
    (err) => {
      assert.equal(err.code, 'FORBIDDEN');
      return true;
    }
  );
});

test('updateProfile - rejects malformed or destructive skill tags (FR-3)', async () => {
  await assert.rejects(
    () => userService.updateProfile('507f1f77bcf86cd799439011', {
      skillsTeaching: ['<script>bad()</script>', '!!!']
    }),
    (err) => {
      assert.equal(err.code, 'INVALID_SKILL_TAG');
      return true;
    }
  );
});

test('updateProfile - accepts shorthand aliases math, eng, psych, chess', async () => {
  try {
    await userService.updateProfile('507f1f77bcf86cd799439011', {
      skillsTeaching: ['math', 'eng', 'psych', 'chess']
    });
  } catch (err) {
    assert.notEqual(err.code, 'INVALID_SKILL_TAG');
    assert.notEqual(err.code, 'VALIDATION_ERROR');
  }
});

test('updateProfile - rejects skillsTeaching that is not an array (FR-3)', async () => {
  await assert.rejects(
    () => userService.updateProfile('507f1f77bcf86cd799439011', {
      skillsTeaching: 'python'
    }),
    (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      return true;
    }
  );
});

test('updateProfile - rejects more than 15 skill tags (FR-3)', async () => {
  const tooMany = ALLOWED_SKILL_TAGS.slice(0, 16);
  await assert.rejects(
    () => userService.updateProfile('507f1f77bcf86cd799439011', {
      skillsTeaching: tooMany
    }),
    (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      assert.ok(err.message.includes('15'));
      return true;
    }
  );
});

test('updateProfile - accepts valid skill tags and deduplicates (FR-3)', async () => {
  // We can verify the validation path passes by confirming no throw before DB call
  // The DB call will fail with a cast error on the fake ID — that's expected in unit tests
  try {
    await userService.updateProfile('507f1f77bcf86cd799439011', {
      skillsTeaching: ['python', 'python', 'algorithms'] // duplicate python
    });
  } catch (err) {
    // Should fail at DB (invalid ObjectId format or not found), NOT at validation
    assert.notEqual(err.code, 'INVALID_SKILL_TAG');
    assert.notEqual(err.code, 'VALIDATION_ERROR');
  }
});

test('updateProfile - rejects invalid gender values', async () => {
  await assert.rejects(
    () => userService.updateProfile('507f1f77bcf86cd799439011', {
      gender: 'other'
    }),
    (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      assert.ok(err.message.includes('Gender'));
      return true;
    }
  );
});

test('updateProfile - accepts male and female gender', async () => {
  try {
    await userService.updateProfile('507f1f77bcf86cd799439011', {
      gender: 'male'
    });
  } catch (err) {
    assert.notEqual(err.code, 'VALIDATION_ERROR');
  }

  try {
    await userService.updateProfile('507f1f77bcf86cd799439011', {
      gender: 'female'
    });
  } catch (err) {
    assert.notEqual(err.code, 'VALIDATION_ERROR');
  }
});

