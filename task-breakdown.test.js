import test from "node:test";
import assert from "node:assert/strict";
import { validateTaskBreakdownPatch, wouldCreateDependencyCycle } from "./task-breakdown.js";

const task = (id, dependencies = [], archived = false) => ({ id, archived, raw: { dependencies } });
const tasks = [task("task-a"), task("task-b", ["task-c"]), task("task-c")];

test("accepts a valid task breakdown patch", () => {
  assert.equal(validateTaskBreakdownPatch(tasks[0], {
    subtasks: [{ title: "Review permissions", done: false }],
    acceptanceCriteria: [{ title: "Viewer cannot write", done: true }],
    dependencies: ["task-b"]
  }, tasks), "");
});

test("rejects malformed checklist entries", () => {
  assert.match(validateTaskBreakdownPatch(tasks[0], {
    subtasks: [{ title: "", done: false }]
  }, tasks), /Subtasks/);
  assert.match(validateTaskBreakdownPatch(tasks[0], {
    acceptanceCriteria: [{ title: "Missing completion state" }]
  }, tasks), /Acceptance criteria/);
});

test("rejects duplicate, missing, archived, and self dependencies", () => {
  assert.match(validateTaskBreakdownPatch(tasks[0], { dependencies: ["task-b", "task-b"] }, tasks), /more than once/);
  assert.match(validateTaskBreakdownPatch(tasks[0], { dependencies: ["missing"] }, tasks), /active task/);
  assert.match(validateTaskBreakdownPatch(tasks[0], { dependencies: ["task-a"] }, tasks), /active task/);
  assert.match(validateTaskBreakdownPatch(tasks[0], { dependencies: ["archived"] }, [...tasks, task("archived", [], true)]), /active task/);
});

test("rejects indirect dependency cycles", () => {
  assert.equal(wouldCreateDependencyCycle("task-a", "task-b", tasks, ["task-b"]), false);
  assert.equal(wouldCreateDependencyCycle("task-c", "task-b", tasks, ["task-b"]), true);
  assert.match(validateTaskBreakdownPatch(tasks[2], { dependencies: ["task-b"] }, tasks), /cycle/);
});
