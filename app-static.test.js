import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");

test("index markup has unique IDs", () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  assert.deepEqual(duplicates, []);
});

test("linked Story lifecycle updates its Story record", () => {
  assert.match(app, /function linkedUserStory\(task\)/);
  assert.match(app, /if \(!story && !hasLegacyStory && !String\(task\.raw\.userStoryId \|\| ""\)\.trim\(\)\) return "";/);
  assert.match(app, /await updateDoc\(userStoryReference\(story\.id\), \{\s*lifecycle: nextState,/);
  assert.match(app, /Task copies are not independently changed\./);
});

test("dashboard burndown has a local date-range helper", () => {
  assert.match(app, /function getDateRange\(startDate, endDate\)/);
  assert.match(app, /const dates = getDateRange\(activeSprint\.startDate, activeSprint\.endDate\);/);
});

test("sprint form supports optional member capacities", () => {
  assert.match(app, /function collectSprintMemberCapacities\(\)/);
  assert.match(app, /memberCapacities = collectSprintMemberCapacities\(\)/);
  assert.match(app, /renderSprintMemberCapacityInputs\(s\.memberCapacities \|\| \{\}\)/);
});

test("an opened mobile drawer restores collapsed sidebar content", () => {
  assert.match(app, /mobile-sidebar-open/);
  assert.match(readFileSync(new URL("./style.css", import.meta.url), "utf8"), /\.app-shell\.mobile-sidebar-open\.sidebar-collapsed > \.sidebar \{[\s\S]*background:#102a45;/);
  assert.match(readFileSync(new URL("./style.css", import.meta.url), "utf8"), /\.app-shell\.mobile-sidebar-open\.sidebar-collapsed > \.sidebar \{[\s\S]*flex-direction:column;/);
});

test("mobile navigation keeps a hamburger control while open", () => {
  assert.doesNotMatch(app, /<span>Close<\/span>/);
  assert.match(app, /els\.mobileNavToggle\.textContent = "☰"/);
  assert.match(readFileSync(new URL("./style.css", import.meta.url), "utf8"), /mobile-sidebar-open \.mobile-nav-toggle \{[\s\S]*right:calc\(100vw - min\(88vw, 340px\) \+ 12px\)/);
});

test("sprint KPI grid fills the final row on narrower screens", () => {
  const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");
  assert.match(css, /\.planning-metric:last-child\{grid-column:1\/-1\}/);
  assert.match(css, /@media\(min-width:1200px\) \{ \.planning-metrics \{ grid-template-columns:repeat\(5/);
});

test("Sprint Planning initially selects the active dated Sprint for burndown", () => {
  assert.match(app, /planningSprintInitialized: false/);
  assert.match(app, /const activeSprintName = String\(getActiveSprintMeta\(\)\?\.sprint \|\| ""\)\.trim\(\)/);
  assert.match(app, /sprintNames\.includes\(activeSprintName\) \? activeSprintName : "all"/);
});

test("burndown renders before attempting the optional snapshot read", () => {
  const chartMarkup = app.indexOf("chart.innerHTML='<svg viewBox");
  const snapshotLoad = app.indexOf("try { loadSprintSnapshots(sprintMetadata?.id); }");
  assert.ok(chartMarkup >= 0 && snapshotLoad > chartMarkup);
  assert.match(app, /appState\.sprintSnapshots\?\.\[sprintMetadata\?\.id\]/);
});

test("Sprint Execution DOM elements are registered before rendering", () => {
  assert.match(app, /sprintExecutionBoard: document\.getElementById\("sprintExecutionBoard"\)/);
  assert.match(app, /sprintBurndownSummary: document\.getElementById\("sprintBurndownSummary"\)/);
  assert.match(app, /sprintBurndownChart: document\.getElementById\("sprintBurndownChart"\)/);
});

test("Sprint Execution constrains task-heavy columns to a consistent workspace", () => {
  const css = readFileSync(new URL("./sprint-execution.css", import.meta.url), "utf8");
  assert.match(css, /\.execution-layout \{ height:430px; align-items:stretch; \}/);
  assert.match(css, /\.execution-column \{ min-height:0; overflow-y:auto;/);
});
