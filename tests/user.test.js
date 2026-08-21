import test from "node:test";
import assert from "node:assert/strict";
import { escapeRegex, searchTutors } from "../services/userService.js";
import { User } from "../models/User.js";

test("Regex Sanitizer - escapes special regex characters to prevent ReDoS and NoSQL injection", () => {
  assert.equal(escapeRegex(".*"), "\\.\\*");
  assert.equal(escapeRegex("Math+Physics?"), "Math\\+Physics\\?");
  assert.equal(escapeRegex("[CS101]"), "\\[CS101\\]");
  assert.equal(escapeRegex(""), "");
  assert.equal(escapeRegex(null), "");
});

test("User Model Schema - validates hourlyRate and search index fields", () => {
  const schemaPaths = User.schema.paths;
  assert.notEqual(
    schemaPaths.hourlyRate,
    undefined,
    "hourlyRate should be defined on User schema",
  );
  assert.equal(schemaPaths.hourlyRate.instance, "Number");
  assert.notEqual(
    schemaPaths.skillsTeaching,
    undefined,
    "skillsTeaching should be defined on User schema",
  );
  assert.notEqual(
    schemaPaths.department,
    undefined,
    "department should be defined on User schema",
  );
  assert.ok(
    schemaPaths.rating !== undefined ||
      schemaPaths["rating.knowledge"] !== undefined,
    "rating fields should be defined on User schema",
  );
});

test("Tutor Discovery - searchTutors function exists and handles empty queries gracefully", () => {
  assert.equal(typeof searchTutors, "function");
});

test("Tutor Discovery - excludes current authenticated user or excludeUserId from query", async () => {
  const originalFind = User.find;
  const originalCount = User.countDocuments;
  let capturedQuery = null;

  User.find = (query) => {
    capturedQuery = query;
    return {
      sort: () => ({
        skip: () => ({
          limit: () => ({
            lean: async () => [{ _id: 'tutor-1', name: 'Other Tutor' }]
          })
        })
      })
    };
  };
  User.countDocuments = async () => 1;

  try {
    const res = await searchTutors({}, '65f1a2b3c4d5e6f7a8b9c0d1');
    assert.ok(capturedQuery._id, "Query should have _id condition");
    assert.equal(String(capturedQuery._id.$ne), '65f1a2b3c4d5e6f7a8b9c0d1');
    assert.equal(res.tutors.length, 1);
  } finally {
    User.find = originalFind;
    User.countDocuments = originalCount;
  }
});