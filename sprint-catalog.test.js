import test from "node:test";
import assert from "node:assert/strict";
import { buildSprintCatalog, taskBelongsToSprint } from "./sprint-catalog.js";

const configuredSprint = { id: "sprint-1", name: "Sprint 1", startDate: "2026-11-04", endDate: "2026-11-13" };

test("uses configured sprint dates for ID-linked tasks", () => {
  const task = { id: "task-1", pi: "PI 2026 Q4", sprint: "Sprint 1", sprintKey: "PI 2026 Q4::Sprint 1", raw: { sprintId: "sprint-1", sprint: "Sprint 1" } };
  const [catalogSprint] = buildSprintCatalog([task], [configuredSprint]);
  assert.equal(catalogSprint.id, "sprint-1");
  assert.equal(catalogSprint.startDate.toISOString().slice(0, 10), "2026-11-04");
  assert.equal(catalogSprint.endDate.toISOString().slice(0, 10), "2026-11-13");
  assert.equal(catalogSprint.tasks.length, 1);
});

test("retains configured sprints in the calendar when no task is assigned", () => {
  const [catalogSprint] = buildSprintCatalog([], [configuredSprint]);
  assert.equal(catalogSprint.sprint, "Sprint 1");
  assert.equal(catalogSprint.tasks.length, 0);
});

test("uses a name fallback only for a uniquely named legacy sprint", () => {
  const legacyTask = { id: "task-legacy", pi: "PI 1", sprint: "Sprint 1", sprintKey: "PI 1::Sprint 1", raw: { sprint: "Sprint 1" } };
  assert.equal(buildSprintCatalog([legacyTask], [configuredSprint])[0].id, "sprint-1");
  assert.equal(taskBelongsToSprint(legacyTask, configuredSprint), true);
  const catalog = buildSprintCatalog([legacyTask], [configuredSprint, { ...configuredSprint, id: "sprint-2" }]);
  assert.equal(catalog.find((sprint) => sprint.tasks.some((task) => task.id === "task-legacy")).id, "");
});

test("accepts Firestore Timestamp-like sprint dates", () => {
  const timestamp = (value) => ({ toDate: () => new Date(`${value}T12:00:00Z`) });
  const [sprint] = buildSprintCatalog([], [{ id: "sprint-1", name: "Sprint 1", startDate: timestamp("2026-11-04"), endDate: timestamp("2026-11-13") }]);
  assert.equal(sprint.startDate.toISOString().slice(0, 10), "2026-11-04");
  assert.equal(sprint.endDate.toISOString().slice(0, 10), "2026-11-13");
});
