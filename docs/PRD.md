# Arcflow Project Planner — Product Requirements Document

**Status:** Proposed baseline from the 4 November 2026 source audit

**Product:** Arcflow project planner
**Scope:** This document specifies the desired product contract. It does not claim every requirement is already implemented.

## Product outcome

Teams need a dependable workspace to plan and track work from Program Increment (PI) through Feature, User Story, Sprint, and Task. The planner must make project scope, permissions, relationships, and delivery reporting trustworthy.

## Users and access

| User | Need | Required access |
|---|---|---|
| Verified Default Project user | Organise shared/default work | The current shared-default model must be explicitly approved and documented. |
| Project owner | Govern a named project | Create/archive project; manage members; manage planning records. |
| Project editor | Plan and maintain delivery work | Create/edit/archive project-scoped planning records and tasks. |
| Project viewer | Observe work safely | Read project-scoped work only. |

Authentication establishes identity. Firestore rules, rather than hidden controls, establish authorization.

## Product principles

- Firestore document IDs and Firebase UIDs are canonical identities. Titles, labels, and display names are never relationship keys.
- Each record belongs to either the Default Project or exactly one named project; data must not cross scope.
- A User Story is an independent record and may have zero tasks.
- Existing data remains usable through staged, reversible migration. Ambiguous legacy links are reported, never guessed.
- A write either completes or exposes an actionable error. The UI must not report success after a failed persistence operation.
- Reports distinguish recorded delivery history from projections and current snapshots.

## Functional requirements

### Project access and membership

- A verified user can create a named project and becomes its owner in the same atomic operation.
- Owners can add/remove editors and viewers. Only owners manage membership and archive named projects.
- Editors can change project work; viewers cannot write.
- Removing a member removes membership references and future project queries no longer return that project.
- Archived projects are unavailable for normal project reads/writes and no longer appear as active choices.

### Planning hierarchy

- PIs, Features, Sprints, User Stories, and Tasks are separate, project-scoped records.
- A Feature has one `piId`; a Story has a `featureId` and matching `piId`.
- A Task may link through `userStoryId`, `featureId`, `piId`, `sprintId`, and `assigneeUid`. Display labels are compatibility snapshots only.
- A Sprint is first-class, with name, goal, dates, capacity, lifecycle, and stable ID. Tasks are assigned by `sprintId`, not sprint name.
- Links cannot reference another project, an archived parent, or an incompatible Feature/PI pair.

### User Stories

- Users can independently create, edit, archive, restore, and view Stories.
- Title is required (1–160 characters); Feature is required. Description, owner, PI, dates, and acceptance criteria remain optional unless a selected Feature determines the PI.
- Target date cannot precede start date; selected Feature and PI must be compatible.
- Story lifecycle is persisted once on the Story record: Draft, Ready, In Progress, In Review, or Accepted.
- A lifecycle change is reflected consistently in cards, lists, task detail, and reports. A legacy task display copy must not become a competing source of truth.
- Changing a Story title preserves its ID and task links. Duplicate titles remain independent.

### Tasks, checklists, and dependencies

- Users can create, edit, copy, archive, delete (when authorized), assign, estimate, and move tasks through To Do, In Progress, and Done.
- Validation includes a non-empty task name, non-negative story points, valid date order, known assignee where selected, and valid hierarchy links.
- Subtasks, acceptance criteria, and dependencies have a documented bounded shape.
- Dependencies must point to an accessible task in the same project, be unique, and be acyclic. Invalid/dangling links are reported, not silently ignored.
- WIP limits are advisory unless the product owner explicitly makes them policy.

### Sprint planning and reports

- Owners/editors can create, edit, archive, and plan sprints.
- Sprint assignment persists an ID and, during compatibility support, a display name; joins and validation use the ID.
- Capacity, missing assignees/dates, and over-capacity are explicitly surfaced.
- Daily snapshots retain scope, source date, recorder, count, and points. Reports must label unavailable data rather than inventing history.

### Usability and accessibility

- Board, list, dashboard, story, planning, report, knowledge, and profile views remain responsive on mobile and desktop.
- Controls are keyboard reachable, labelled, and offer loading, empty, error, and read-only states.
- Dialogs trap focus, restore focus to the invoking control, and handle Escape/overlay interaction consistently.
- Every HTML `id` is unique; charts and labels bind to the intended view.

## Confirmed audit gaps and priorities

| Priority | Confirmed gap | Required outcome |
|---|---|---|
| P0 | A lifecycle change in task detail updates task `userStoryStatus`, but can leave the independent Story `lifecycle` unchanged. | Make the Story document authoritative and test cross-view consistency. |
| P0 | `index.html` has duplicate `velocityChart` and `inProgressCount` IDs; DOM lookup uses only the first. | Assign unique IDs and add a DOM uniqueness check. |
| P0 | Rules limit checklist/dependency list size but not nested shape, dependency scope/existence, or cycle integrity. | Define and validate the record contract; detect legacy corruption. |
| P1 | Named projects have roles; the Default Project is shared by verified users with different creator/status semantics. | Approve/document this policy or migrate it to equivalent role governance. |
| P1 | Legacy name/title fallbacks can be ambiguous after rename or duplicate names. | Use ID-first writes/joins; map legacy data only when uniquely validated. |
| P1 | Story edit writes the Story and then linked Tasks in independent batches. Later failure can leave partial propagation. | Make propagation resumable/idempotent and expose partial failure. |
| P1 | The client loads all planning records and uses overlapping membership discovery paths. | Establish bounded/paginated queries and one authoritative discovery path before growth. |
| P1 | Production build emits a 558.61 kB minified Firebase/auth chunk (166.23 kB gzip). | Profile and set a performance budget; split noncritical views after measurement. |
| P2 | Dialog accessibility and real browser/device workflows were not verified by this audit. | Add automated accessibility checks and manual acceptance coverage. |
| P2 | Deployment documentation includes stale task-field/access descriptions. | Keep one current operational and data-contract reference with every schema/rule change. |

## Release order

1. **P0 stability/data correctness:** unique IDs, Story lifecycle source of truth, and checklist/dependency contract with regression tests.
2. **P1 access/compatibility:** Default Project governance decision, unsafe name-link removal, read-only inventory, and reviewed migration manifest.
3. **P1 scale/quality:** Firestore emulator authorization coverage, error-recovery tests, pagination/query design, and performance profiling.
4. **P2 experience:** dialog keyboard behaviour, mobile/browser verification, then targeted visual polish only where required.

## Acceptance criteria

- A Story with no tasks persists and retains ID after reload/title edit.
- Lifecycle is identical in Story document, task views, cards, and reports after reload.
- Duplicate Story/Feature/Sprint titles cannot link unrelated work.
- Owner/editor/viewer/default-scope allowed and denied operations are tested.
- Cross-project, cyclic, malformed, and dangling dependencies are prevented or reported predictably.
- Multi-batch propagation cannot show a false complete success state.
- Build, automated test, and manual browser/mobile results are recorded accurately.

## Out of scope

This PRD does not authorize chat, notifications, payments, new authentication methods, new Firebase services, or a UI redesign. A new collection, schema migration, role-model change, or dependency requires a separately approved implementation request.
