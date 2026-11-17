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

test("task list retains its layout while using compact row spacing", () => {
  const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");
  assert.match(css, /Compact task-list pass/);
  assert.match(css, /\.task-table td \{ padding-top: 9px; padding-bottom: 9px; \}/);
  assert.match(css, /\.list-task-marker \{ height: 26px; \}/);
});

test("task list does not render task IDs beneath task names", () => {
  const listRenderer = app.slice(app.indexOf("function renderList("), app.indexOf("function updateBulkArchiveControls("));
  assert.doesNotMatch(listRenderer, /task-identity-inline/);
  assert.doesNotMatch(listRenderer, /TASK ID/);
});

test("task detail modal prioritizes delivery context over internal identifiers", () => {
  const taskModal = app.slice(app.indexOf("function openTaskModal(task)"), app.indexOf("function renderTaskUpdates(task)"));
  assert.doesNotMatch(taskModal, /Firestore Document ID|Project ID|Created by User ID|Assignee User ID|PI ID/);
  assert.match(taskModal, /modalRow\("Schedule"/);
});

test("task discussion is mounted in the task detail sidebar", () => {
  assert.match(html, /<div id="taskUpdatesPanel"><\/div>/);
  assert.match(app, /taskUpdatesPanel:\s*document\.getElementById\("taskUpdatesPanel"\)/);
  assert.match(app, /els\.taskUpdatesPanel\.innerHTML = renderTaskUpdates\(task\)/);
});

test("task dependencies provide a searchable prerequisite picker", () => {
  assert.match(app, /id="dependencySearchInput" type="search"/);
  assert.match(app, /option\.hidden = Boolean\(search\)/);
});

test("administrator access uses the configured bootstrap UID and invite workflow", () => {
  assert.match(app, /const BOOTSTRAP_ADMIN_UID = "UosH0j7JVLYCKYwTYOeAJXqk7Ge2"/);
  assert.match(app, /function openAdminUsers\(\)/);
  assert.match(app, /function createAdminInvitation\(event\)/);
  assert.match(app, /function manageProjectAccess\(event\)/);
  assert.match(html, /id="adminUsersModal"/);
  assert.match(html, /Create invitation/);
  assert.match(html, /Grant access/);
  assert.match(html, /Revoke access/);
});

test("administrator modal has a constrained management layout", () => {
  const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");
  assert.match(css, /#adminUsersModal \.admin-users-editor \{[\s\S]*width: min\(820px, calc\(100vw - 32px\)\)/);
  assert.match(css, /#adminUsersModal \.admin-project-access \{[\s\S]*border-radius: 12px/);
});

test("dashboard focus queue has professional priority-row affordances", () => {
  const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");
  assert.match(app, /dashboard-task-sequence/);
  assert.match(app, /dashboard-task-open/);
  assert.match(css, /Dashboard focus queue/);
  assert.match(css, /grid-template-columns: 25px minmax\(0, 1fr\) auto 15px/);
});

test("dashboard focus queue links to the complete Work Items view", () => {
  assert.match(html, /id="viewAllTasksBtn" class="dashboard-view-all"/);
  assert.match(app, /viewAllTasksBtn:\s*document\.getElementById\("viewAllTasksBtn"\)/);
  assert.match(app, /els\.viewAllTasksBtn\?\.addEventListener\("click", \(\) => setActiveView\("list"\)\)/);
});

test("profile groups account identity, details, and project access without removing profile fields", () => {
  assert.match(html, /class="profile-summary" aria-label="Account summary"/);
  assert.match(html, /id="profileDisplayName"/);
  assert.match(html, /id="profileAvatarInitials"/);
  assert.match(html, /id="profileProjectId"/);
  assert.match(app, /profileDisplayName:\s*document\.getElementById\("profileDisplayName"\)/);
  assert.match(app, /els\.profileAvatarInitials\.textContent/);
});

test("workspace header separates user context, project selection, and actions", () => {
  assert.match(html, /class="topbar-identity"/);
  assert.match(html, /class="topbar-project-control"><label for="projectSelect">Project<\/label>/);
  assert.match(html, /<div class="topbar-actions">\s*<button id="newProjectBtn"/);
  assert.match(readFileSync(new URL("./style.css", import.meta.url), "utf8"), /Workspace header: separate identity, search, and project controls/);
});

test("workspace header carries the Arcflow identity while desktop sidebar branding stays compact", () => {
  assert.match(html, /class="topbar-product-name">Arcflow<\/strong>/);
  assert.match(html, /class="topbar-tagline">Plan with clarity<\/span>/);
  assert.match(html, /id="currentUserName" class="user-name topbar-user-context"/);
  assert.match(readFileSync(new URL("./style.css", import.meta.url), "utf8"), /@media \(min-width: 1101px\) \{[\s\S]*?\.app-shell > \.sidebar > \.brand-block \{ display: none; \}/);
});

test("expanded desktop sidebar reserves space for its collapse control", () => {
  assert.match(readFileSync(new URL("./style.css", import.meta.url), "utf8"), /\.app-shell:not\(\.sidebar-collapsed\) > \.sidebar \{ padding-top: 64px; \}/);
});

test("Arcflow header identity returns to the overview view", () => {
  assert.match(html, /<button id="topbarOverviewBtn" class="topbar-identity" type="button" aria-label="Open Arcflow overview">/);
  assert.match(app, /topbarOverviewBtn:\s*document\.getElementById\("topbarOverviewBtn"\)/);
  assert.match(app, /els\.topbarOverviewBtn\?\.addEventListener\("click", \(\) => setActiveView\("dashboard"\)\)/);
});

test("sprint planning provides a collapsible capacity section and date-calendar modal", () => {
  const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");
  assert.match(html, /id="sprintMemberCapacityToggle"/);
  assert.match(html, /id="sprintCalendarModal"/);
  assert.match(app, /function toggleSprintMemberCapacity\(\)/);
  assert.match(app, /function openSprintCalendarModal\(\)/);
  assert.match(app, /id="sprintDatesMetric" class="planning-metric planning-dates-metric"/);
  assert.match(css, /\.sprint-member-capacity\.is-collapsed \.sprint-member-capacity-list \{ display:none; \}/);
  assert.match(css, /\.sprint-calendar-modal-grid \{ display:grid;/);
});

test("sidebar filters use a light workspace surface", () => {
  const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");
  assert.match(css, /Sidebar filters: light workspace surface/);
  assert.match(css, /\.app-shell > \.sidebar \{[\s\S]*background: linear-gradient\(180deg, #f9fbfe 0%, #f2f7fb 100%\)/);
  assert.match(css, /\.app-shell\.sidebar-collapsed > \.sidebar \{ background: #f7fafc;/);
});

test("workspace navigation restores the saved view before dashboard rendering", () => {
  assert.match(html, /document\.documentElement\.dataset\.initialView = preferences\.activeView/);
  assert.match(html, /<nav class="view-switch" aria-label="Workspace navigation">/);
  assert.match(app, /setActiveView\(appState\.activeView, false\);/);
  assert.match(app, /document\.documentElement\.dataset\.initialView = appState\.activeView;/);
  assert.match(readFileSync(new URL("./style.css", import.meta.url), "utf8"), /html\[data-initial-view\]:not\(\[data-initial-view="dashboard"\]\) #dashboardView/);
});

test("primary workspace views share a responsive entry-panel alignment contract", () => {
  const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");
  assert.match(css, /Workspace entry panels: every primary view begins on the same content line/);
  assert.match(css, /#dashboardView > \.portfolio-hero,[\s\S]*#insightsView > \.insights-header/);
  assert.match(css, /min-height: 126px/);
  assert.match(css, /@media \(max-width: 760px\) \{[\s\S]*min-height: 0/);
});

test("task filtering has an all-status option separate from bulk task actions", () => {
  assert.match(html, /id="statusFilter"[\s\S]*<option value="all">All statuses<\/option>/);
  assert.match(app, /status: "all"/);
  assert.match(app, /const matchesStatus = appState\.filters\.status === "all" \|\| task\.statusKey === appState\.filters\.status;/);
  assert.match(app, /matchesAssignee && matchesStatus && matchesSearch/);
  assert.match(html, /Move selected to/);
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

test("task updates use an immutable task subcollection and dashboard work log", () => {
  assert.match(html, /id="dashboardUpdates"/);
  assert.match(app, /function taskUpdateCollection\(taskId\)/);
  assert.match(app, /collectionGroup\(db, "updates"\)/);
  assert.match(app, /function renderTaskUpdates\(task\)/);
  assert.match(app, /function postTaskUpdate\(task, form\)/);
  assert.match(app, /function mergeTaskUpdatesIntoDashboard\(updates\)/);
  assert.match(app, /function loadTaskUpdatesFallbackFromTasks\(tasks\)/);
  assert.match(app, /taskUpdateCollection\(task\.id\),\s*where\("projectId", "==", appState\.activeProjectId\)/);
});

test("dashboard task updates keep task, author, timestamp, and note in a compact two-line row", () => {
  const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");
  assert.match(app, /dashboard-update-heading/);
  assert.match(app, /dashboard-update-summary/);
  assert.match(app, /<time>' \+ escapeHtml\(formatUpdateTime\(update\.createdAt\)\)/);
  assert.match(css, /\.dashboard-update-heading, \.dashboard-update-summary \{ display: flex;/);
  assert.match(css, /\.dashboard-update-row \{[\s\S]*min-height: 50px/);
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

test("task modal panels can be resized on desktop without changing mobile stacking", () => {
  const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");
  assert.match(html, /data-resizable-layout="task-detail"/);
  assert.match(html, /data-resizable-layout="task-editor"/);
  assert.match(html, /data-panel-resizer="task-detail"/);
  assert.match(html, /data-panel-resizer="task-editor"/);
  assert.match(app, /function bindResizablePanels\(\)/);
  assert.match(app, /panelWidths: "cliniqPlanner\.panelWidths\.v1"/);
  assert.match(css, /\.panel-resizer \{/);
  assert.match(css, /@media \(max-width: 760px\) \{[\s\S]*\.panel-resizer \{ display: none; \}/);
});

test("filter sidebar starts collapsed and remembers an explicit user choice", () => {
  assert.match(html, /<div class="app-shell sidebar-collapsed">/);
  assert.match(html, /aria-label="Expand sidebar" aria-expanded="false"/);
  assert.match(app, /sidebarCollapsed: true/);
  assert.match(app, /if \(typeof prefs\.sidebarCollapsed === "boolean"\) appState\.sidebarCollapsed = prefs\.sidebarCollapsed;/);
  assert.match(app, /sidebarCollapsed: appState\.sidebarCollapsed,/);
});
