# Arcflow implementation audit

Branch reviewed: `feature/arctflow-ui-stories`

## Scope reviewed
Reviewed the current `index.html`, `app.js`, `style.css`, `firestore.rules`, `firebase.json`, and `package.json` from the feature branch. This is a source-level audit; no browser, emulator, or automated test suite was run as part of this review.

## Existing capabilities confirmed in source
- Firebase Authentication-backed user and project access.
- Project creation, project membership, roles, and project selection.
- Task create/edit/copy/delete, status, archive, assignment, PI, sprint, feature, priority and dates.
- List, Kanban, User Stories, Profile, and Agile Insights views.
- Filtering, search, sorting, WIP limits, task selection, bulk archive, and bulk status update.
- Firestore security rules for verified users, project membership, and owner/editor/viewer access.

## Issues and risks to address
1. **Mobile modal sizing:** task detail actions could stretch excessively on small screens. A targeted mobile layout fix has been committed to this branch.
2. **Responsive CSS accumulation:** multiple appended overrides make responsive behavior difficult to reason about. Consolidate duplicate media queries and selectors after visual regression checks.
3. **No automated test command:** `package.json` exposes Vite dev/build/preview scripts only. Add a repeatable build and tests for critical data workflows.
4. **Data model is task-centric:** User Stories are represented through task fields such as `userStory` and `userStoryDescription`; there is no dedicated story entity visible in the reviewed schema. Epic hierarchy, acceptance criteria lifecycle, and story-level estimates should be designed deliberately before adding them.
5. **Dependencies and subtasks are not present in the reviewed task schema:** `validTask` in Firestore rules uses an allowlist and does not include dependency/subtask fields. These features require coordinated schema, rules, UI, migration/backward-compatibility, and tests—not just new controls.
6. **Audit trail and collaboration:** the reviewed schema does not show a task activity/comments collection or notification workflow. These should be added with explicit access rules and retention expectations.
7. **Firestore rules deserve emulator tests:** verify owner/editor/viewer behavior, archived project behavior, bulk writes, and cross-project isolation. Do not weaken rules to make a UI action work.
8. **Runtime validation remains outstanding:** the code has not been exercised here in an authenticated browser against the configured Firebase project. The mobile screenshots are useful evidence, but cannot replace browser/device testing.

## Recommended implementation order
### Release 1 — Stability
- Fix mobile modal/sidebar and toolbar layouts.
- Consolidate responsive CSS carefully.
- Add build validation and Firestore rules emulator tests.
- Verify create/edit/status/archive/member workflows for owner, editor, and viewer.

### Release 2 — Core work breakdown
- Add subtasks/checklists with stable task IDs and parent-child validation.
- Add dependency relationships with cycle prevention and blocked-state indicators.
- Update Firestore rules, UI, and tests together.

### Release 3 — Agile planning
- Add story acceptance criteria and lifecycle.
- Add story points and sprint capacity/overcommitment calculations.
- Add sprint planning and burndown based on persisted dates and estimates.

### Release 4 — Collaboration and reporting
- Add task comments/activity timeline and notification preferences.
- Improve workload, overdue, blocked-work, sprint, and release dashboards.

## Definition of done
Each feature should include: data model, permission rules, loading/empty/error states, accessible responsive UI, tests for allowed and denied operations, and documented manual verification steps. Avoid hardcoded production metrics and avoid claiming browser/device verification until it has actually been performed.
