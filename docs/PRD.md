# Arcf​low Project Planner — Product Requirements Document

**Status:** Active development  
**Current focus:** Phase 1 — User Story stabilization  
**Target:** Multi-user Agile project planning application

## Product vision
Provide teams with a reliable, clear workspace to plan and deliver work through Projects, Program Increments (PIs), Features, User Stories, Sprints, Tasks, and dependencies.

## Product principles
- A User Story is an independent planning record; creating one must not require a Task.
- Stable IDs, not mutable titles, define relationships.
- Project data is scoped and protected by explicit membership and roles.
- UI, validation, Firestore rules, and reporting must agree.
- Historical reporting must use recorded history, not fabricated estimates presented as actuals.
- Preserve legacy data through staged migrations and provide a rollback path.

## Target conceptual model
```
Project
 ├── Program Increments (PIs)
 │    ├── Features
 │    │    └── User Stories
 │    │         └── Tasks
 │    │              ├── Subtasks
 │    │              └── Dependencies
 │    └── Sprints (timeboxes; work is assigned to them)
 └── Project Members
```
Sprints are timeboxes and are not necessarily permanent parents of tasks.

## Phase roadmap
1. **Stabilize User Story Management (current, critical):** create/edit stories independently, preserve stable identity and task links, handle legacy records, validate permissions and persistence.
2. **Canonical Agile data model (critical):** independent PI, Feature, Sprint, Story and Task entities with stable IDs, staged migration, validation and rollback.
3. **UI/UX consistency (high):** accessible responsive cards, details panel, consistent forms, navigation and overflow fixes.
4. **Lifecycle enforcement (high):** validated story/task transitions, explicit readiness rules, audit history and consistent progress calculations.
5. **Sprint planning (high):** sprint goals/dates, backlog assignment, capacity, carryover and sprint reporting.
6. **Agile Insights (high):** PI/Feature progress, velocity, burndown, aging, spillover, workload and cycle time backed by recorded history.
7. **Collaboration (medium):** dependencies, blockers, comments, mentions, activity timeline and configurable notifications.
8. **Production readiness (release gate):** automated tests, access controls, migration/rollback documentation, performance and end-to-end verification.

## Phase 1 requirements

### US-1 Create a User Story independently
- Required: title (1–160 characters).
- Optional: description (up to 1,500 characters), acceptance criteria (up to 50 entries, each up to 500 characters), PI, Feature, start date, target date.
- Target date cannot precede start date.
- Saving a story creates a stable-ID document even when no tasks exist.
- New story lifecycle defaults to Draft.
- Save button has a loading state and cannot submit twice; errors remain visible and actionable.

### US-2 Edit a User Story
- Update title, description, acceptance criteria, PI, Feature and dates without changing its stable ID.
- Preserve creation metadata and lifecycle.
- Editing one story must not modify another story merely because their titles match.
- Linked tasks remain linked by story ID after a title change.
- Legacy stories can be upgraded without linking unrelated tasks.

### US-3 Link tasks
- Tasks may be added after story creation.
- Story identity must be carried through task creation/editing by ID.
- Title-based matching is permitted only for carefully constrained legacy migration; never use it to merge identified stories.
- Stories with zero tasks remain visible and editable.
- Duplicate story titles must not cause incorrect linking.

### US-4 Legacy compatibility
- Existing tasks and story associations remain intact.
- Legacy story-only-on-task records remain discoverable.
- Avoid duplicate cards when a legacy story is upgraded to a standalone record.
- Do not perform destructive bulk migration without validation and rollback.

### US-5 Security and persistence
- Default-project and project-scoped stories use the correct collection path.
- Firestore rules validate allowed fields and values.
- Only authorized users can write records; project-scoped access follows project membership/role.
- Test create/read/update/delete permissions, refresh persistence, and sign-in behavior against the intended Firebase project.

### Additional User Story archive and card-density requirements
- Users can archive a story without deleting its tasks.
- Archived stories are hidden from the active story list and accessible through a Show archived filter.
- Users can restore an archived story.
- Archiving/restoring is persisted and protected by the same project authorization as story edits.
- Story cards show at most two task previews by default and provide an explicit Show all / Show fewer control for remaining tasks.
- Users can switch between Cards and List view; List view makes it easier to scan many stories and their tasks.
- The list layout remains responsive and task lists are scrollable within the row so a story with many tasks does not make the whole page excessively tall.

## Phase 1 acceptance tests
1. Create a story with a title and no task; it appears with zero tasks.
2. Reload the page; the story persists.
3. Create two stories with the same title; each remains independently editable.
4. Edit a story title; its ID stays unchanged and its linked tasks remain linked.
5. Add a task from a story card; the saved task references that exact story ID.
6. Edit the task; the association remains unless the user explicitly changes it.
7. Edit a legacy story; only the intended legacy tasks are upgraded/linked.
8. Verify a non-member cannot read or write project-scoped story data and a viewer cannot write.
9. Validate form fields and display understandable errors.
10. Production build passes and browser console has no uncaught errors during the tested flow.
11. Archive a story; it disappears from active stories but its tasks remain unchanged.
12. Show archived stories, restore one, and verify it returns to the active list after refresh.
13. Link at least 10 tasks to one story; Cards view initially shows two tasks and Show all reveals the remainder; Show fewer collapses the preview.
14. Switch between Cards and List view; verify all linked tasks are reachable and layout remains usable on desktop and mobile.

## Definition of done
A phase is complete only when code is committed, a production build passes, relevant automated/integration tests are run, and results are reported accurately. A code presence check alone is not a live integration test. Do not claim Firestore or browser verification without running it.

## Phase 1 implementation sequence
1. Audit current UI handlers, collection paths, rules and legacy grouping.
2. Fix form parsing/validation and stable-ID association defects.
3. Ensure edits preserve creation metadata and synchronize task links safely.
4. Ensure legacy-to-standalone conversion does not merge duplicate-title stories.
5. Add automated test coverage where supported; otherwise provide a reproducible manual test matrix.
6. Build and test against the correct Firebase project before deploying rules.
