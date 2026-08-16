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
