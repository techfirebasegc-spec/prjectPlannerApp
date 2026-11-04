# Arcflow data-model audit and safe migration plan

**Branch:** `feature/arctflow-ui-stories`  
**Audit type:** source-level audit of the checked-in application and Firestore rules.  
**Data status:** no live Firestore export or authenticated data scan was available for this audit. Findings about individual production records are therefore *unverified*, not assumed absent or present.

## Executive summary

Arcflow already has stable Firestore document IDs for many planning records and stores several relationship IDs. The main risk is inconsistent use of those IDs across read/write paths: some views still join by display names, legacy stories are inferred from task text, and the User Story view currently drops persisted owner/PI/Feature IDs when normalizing records for display. A schema migration should not start until the existing data has been inventoried and the current read/write contract is tested.

**No Firestore records were changed by this audit. No schema migration is included in this commit.**

## Current model observed in source

| Entity | Current source-of-truth location / fields | Relationship and consistency concerns |
|---|---|---|
| Task | `plannerTasks/{taskId}` for the shared default project and `plannerProjects/{projectId}/tasks/{taskId}` for project-scoped work. Task document ID is the task ID. Fields include `task`, `status`, `assigneeUid`, display-name `assignee`, `userStoryId`, legacy `userStory`, `piId`, `pi`, `featureId`, `feature`, and text sprint. | Some fields have stable IDs and compatibility labels. Sprint is represented as a string rather than a sprint document ID in the inspected task shape. Legacy story links may be resolved by title. |
| User Story | `plannerUserStories/{storyId}` for default-project stories and `plannerProjects/{projectId}/userStories/{storyId}` for project stories. Fields include `title`, `owner`, `ownerUid`, `piId`/`pi`, `featureId`/`feature`, dates, lifecycle, acceptance criteria, archive state and audit timestamps. | The story renderer builds a view model without copying `owner`, `ownerUid`, `piId`, and `featureId`. The owner detail therefore cannot reliably display the saved story owner. Legacy task-only stories are synthesized from task text and have no independent story document. |
| Feature | `plannerFeatures/{featureId}` for the default project and `plannerProjects/{projectId}/features/{featureId}` for project-scoped features. Fields include `piId`/`pi`, `ownerUid`/`owner`, status, priority, archive state and timestamps. | Some reports link stories/tasks by Feature ID **or** matching Feature name. Name-based joins can merge unrelated same-named records and become stale after renames. |
| Program Increment (PI) | `plannerProgramIncrements/{piId}` or `plannerProjects/{projectId}/programIncrements/{piId}`; fields include name, dates, status and archive state. | Some counts and lookups fall back to PI name. Feature rules check the referenced PI exists in the corresponding collection for the path. |
| Sprint | Task has a `sprint` string; the inspected task schema does not establish a canonical sprint document ID or a single sprint record contract. | Sprint name/text can be renamed inconsistently; sprint date and committed-work consistency cannot be validated from the task field alone. Confirm whether sprint records exist elsewhere before designing a new collection. |
| User / member | Firebase Auth UID is used as the stable identity. Project members live under `plannerProjects/{projectId}/members/{uid}`; default assignment choices are read from `plannerDirectory`. | Display names are denormalized for display. Directory/project membership discrepancies can leave assignments pointing to former or missing members. |
| Project | `plannerProjects/{projectId}` with `ownerId`; membership and user project pointers are separate documents/subcollections. | Project membership and permissions must remain authoritative. Do not migrate or merge project scopes by matching names. |

### Relationship contract to adopt

1. **Identity:** Firestore document IDs and Firebase Auth UIDs are canonical. Never use a title, display name, or sprint label as a record identity.
2. **Task assignee:** `assigneeUid` is canonical; `assignee` is an optional display snapshot only. Resolve current display names from the current project member directory when possible.
3. **Task → story:** `userStoryId` is canonical. `userStory` and `userStoryDescription` are compatibility/display fields, not relationship keys.
4. **Task/story → Feature and PI:** `featureId` and `piId` are canonical. `feature` and `pi` are display snapshots for compatibility only. Validate that the Feature belongs to the selected PI and to the same project scope.
5. **Story owner and Feature owner:** `ownerUid` is canonical. `owner` is a display snapshot. Views, reports, and editors must all use the same stored owner UID and shared member resolver.
6. **Sprint:** before introducing `sprintId`, inspect the existing sprint data sources and decide whether sprints are first-class project-scoped records. Do not invent IDs or silently reinterpret existing labels.
7. **Counts and reports:** derive linked-task counts from canonical task relationships, excluding archived tasks/stories according to one documented reporting policy. Do not store independently editable counts.

## Code-confirmed inconsistencies

| ID | Finding | Evidence / impact | Recommended treatment |
|---|---|---|---|
| DM-01 | User Story display normalization omits persisted owner fields. | In `app.js`, `saveUserStory` persists `owner` and `ownerUid`; `renderUserStories` creates group objects without either field, while detail rendering reads them. An assigned story can display “Unassigned”. | Fix the normalization path and add a regression test for an assigned story, an unresolved UID, and an unassigned story. |
| DM-02 | Feature/PI links fall back to names in multiple reports. | Feature, PI, and story counts/search paths include checks like `story.feature === feature.name`, `task.feature === feature.name`, or `story.pi === pi.name`. | Prefer ID joins when IDs exist. Keep name fallback only in an explicit legacy compatibility layer with ambiguity detection and diagnostics. |
| DM-03 | Legacy story linkage is inferred from title text. | Story normalization and the “Map existing records” routine use `userStory` title matching when `userStoryId` is absent. The mapping routine detects ambiguous title matches but ordinary story rendering still synthesizes title-based groups. | Inventory collisions; only auto-map unique matches. Leave ambiguous records untouched and produce a review report. |
| DM-04 | Sprint relationship is not represented by a canonical ID in the inspected task contract. | Task editor stores a sprint value as a string; task schema/rules accept `sprint` as text. | Confirm existing sprint records and dates before deciding on a sprint collection or adding `sprintId`. |
| DM-05 | Duplicate/invalid production records have not been measured. | Source inspection cannot establish what is currently stored in Firestore. | Run a read-only authenticated export/report before any writes. Do not describe these as confirmed data defects until scanned. |

## Production data audit checklist

Run against a consistent, read-only export from each scope separately (default project and every project ID). Keep original document paths and IDs in the report. Do not print personal email addresses or other unnecessary PII in logs.

- [ ] Duplicate document IDs are not possible within one collection, but detect duplicate logical records (same normalized title/owner/date) for manual review; do not auto-delete.
- [ ] Stories with `ownerUid` that does not resolve to a current project member; separately list legacy `owner` names without UIDs.
- [ ] Tasks with `assigneeUid` not in the project member directory; separately list name-only assignments.
- [ ] Features with missing `piId`, a PI from another scope, or a `pi` snapshot inconsistent with the referenced PI name.
- [ ] Tasks/stories whose Feature and PI IDs disagree.
- [ ] Tasks with missing `userStoryId`, dangling story IDs, or a legacy title matching zero/multiple stories.
- [ ] Tasks with `startDate > endDate`; story/PI/Feature date ranges outside the agreed parent range (report only; business rules may allow exceptions).
- [ ] Sprint labels that have no canonical sprint record, if such records exist; tasks outside sprint date ranges.
- [ ] Story linked-task count compared with actual tasks linked by `userStoryId`; separately report legacy title matches and archived tasks.
- [ ] Archived projects/items appearing in active reports; agree whether archived tasks count in historical completion reports.
- [ ] Near-duplicate records from repeated submissions. Use creation timestamps and audit fields as evidence, never auto-delete based only on matching titles.

**Audit output:** CSV/JSON findings with path, document ID, issue code, severity, and proposed disposition. Avoid including sensitive values that are not needed to resolve the issue. Counts should be reproducible and timestamped.

## Safe, reversible migration plan

### Phase 0 — Freeze the contract (no writes)
1. Confirm the collections and project scopes from the deployed code and a Firestore export.
2. Publish the canonical field contract above and create fixtures for current/legacy shapes.
3. Add unit tests for normalizers and Firestore emulator tests for allowed/denied operations. Preserve existing security rules; do not broaden access for migration convenience.

### Phase 1 — Read-only inventory
1. Export metadata and relevant relationship fields with document path, ID, archive flag, and timestamps.
2. Produce the audit checklist report and classify each finding as auto-mappable, manual review, or intentionally legacy.
3. Record baseline counts by scope: tasks, stories, Features, PIs, members, archived items, dangling links, and ambiguous name matches.
4. Have a project owner review ambiguous mappings before any update.

### Phase 2 — Compatibility-first application release
1. Fix the User Story owner normalization bug.
2. Centralize relationship resolution: ID-first, explicit legacy fallback, ambiguity surfaced as a warning rather than silently selecting a record.
3. Make writes update canonical IDs and compatibility labels together where current rules require both.
4. Add tests before changing rules or migrating existing records.

### Phase 3 — Dry-run migration
1. Generate a deterministic migration manifest with old values, proposed canonical IDs, reason, and confidence.
2. Require unique mapping for title/name fallback; never guess when two candidates match.
3. Re-run the manifest against the same export and confirm it is idempotent.
4. Review counts and sample records with the project owner.

### Phase 4 — Controlled write and verification
1. Back up/export the exact source collections and record the export timestamp.
2. Apply small, bounded batches with per-document before/after logs and retry-safe writes.
3. Do not delete source fields in this phase; retain compatibility fields until all readers have moved to IDs.
4. Re-run the audit and compare counts, dangling links, task/story relationships, and permissions.
5. Roll back from the export/manifest if invariants fail. Stop immediately on unexpected write-denial or scope mismatch.

### Phase 5 — Retire legacy fields (separate release)
Only after all clients and reports are confirmed ID-based and a deprecation window has passed, consider removing name-based fallback and compatibility fields. This requires a separate versioned migration, updated Firestore rules, and tests. It is explicitly **out of scope** for the initial repair.

## Acceptance criteria

- Story owner is consistently shown from `ownerUid` resolved through the member directory, with a clear fallback for unresolved/legacy ownership.
- ID-based joins are authoritative for task/story/Feature/PI relationships.
- Ambiguous legacy links are reported and never silently assigned.
- Audit results distinguish code findings from verified live-data findings.
- Migration has a dry-run manifest, backup, bounded writes, post-migration checks, and rollback instructions.
- Firestore access rules are not weakened, and no production records are changed before audit approval.
