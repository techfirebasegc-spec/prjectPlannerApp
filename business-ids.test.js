import test from "node:test";
import assert from "node:assert/strict";
import { formatBusinessId, highestBusinessIdSequence, parseBusinessIdSequence } from "./business-ids.js";
test("formats finalized prefixes and pads sequences", () => {
  assert.equal(formatBusinessId("pi", 1), "PI-001");
  assert.equal(formatBusinessId("feature", 25), "FEAT-025");
  assert.equal(formatBusinessId("sprint", 100), "SPR-100");
  assert.equal(formatBusinessId("story", 1001), "US-1001");
  assert.equal(formatBusinessId("task", 9), "TASK-009");
});
test("rejects invalid entity types and sequences", () => {
  assert.throws(() => formatBusinessId("unknown", 1), TypeError);
  assert.throws(() => formatBusinessId("task", 0), RangeError);
  assert.throws(() => formatBusinessId("task", 1.5), RangeError);
});
test("parses only matching prefixes and valid suffixes", () => {
  assert.equal(parseBusinessIdSequence("feature", "FEAT-042"), 42);
  assert.equal(parseBusinessIdSequence("feature", "TASK-042"), null);
  assert.equal(parseBusinessIdSequence("feature", "FEAT-42"), null);
});
test("uses high-water marks rather than record counts", () => {
  assert.equal(highestBusinessIdSequence("task", [{code:"TASK-002"},{code:"TASK-021"},{code:"TASK-004"},{code:"US-999"},{}]), 21);
});
