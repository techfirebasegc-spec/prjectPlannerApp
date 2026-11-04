# Arcflow Project Planner — Technical Requirements Document

**Status:** Proposed technical baseline from the 4 November 2026 source audit
**Scope:** Front end, Firebase, data integrity, quality gates, and deployment. No source code or production data was changed by this document.

## Observed implementation

- Vanilla JavaScript SPA built with Vite 7 and Firebase Web SDK 12.
- Firebase Authentication supports email/password and Google sign-in; planner access requires a verified email.
- Firestore is the database; Firebase Hosting serves `dist`; no Cloud Functions are configured.
- Default-scope records are top-level collections. Named-project records live under `plannerProjects/{projectId}`.
- `app.js` is about 218 kB source and `style.css` is about 180 kB source.
- The test command currently has four business-ID unit tests. There are no Firestore emulator, integration, browser, accessibility, or end-to-end tests in the repository.

## Data contract

| Entity | Default Project path | Named Project path |
|---|---|---|
| Project | N/A | `plannerProjects/{projectId}` |
| Membership | N/A | `plannerProjects/{projectId}/members/{uid}` |
| Membership pointer | N/A | `plannerUserProjects/{uid}/projects/{projectId}` |
| PI | `plannerProgramIncrements/{piId}` | `plannerProjects/{projectId}/programIncrements/{piId}` |
| Feature | `plannerFeatures/{featureId}` | `plannerProjects/{projectId}/features/{featureId}` |
| Story | `plannerUserStories/{storyId}` | `plannerProjects/{projectId}/userStories/{storyId}` |
| Sprint | `plannerSprints/{sprintId}` | `plannerProjects/{projectId}/sprints/{sprintId}` |
| Snapshot | `plannerSprints/{sprintId}/dailySnapshots/{date}` | `plannerProjects/{projectId}/sprints/{sprintId}/dailySnapshots/{date}` |
| Task | `plannerTasks/{taskId}` | `plannerProjects/{projectId}/tasks/{taskId}` |

- Firebase UID is the identity for people; document IDs identify planner entities.
- `piId`, `featureId`, `userStoryId`, `sprintId`, and `assigneeUid` are canonical links. Display names/titles are compatibility snapshots only.
- Business codes (`PI-###`, `FEAT-###`, `US-###`, `SPR-###`, `TASK-###`) are human-readable, not relationship or authorization keys.
- New relationship writes validate within the selected project scope. Name matching is limited to explicit reviewed legacy mapping.

## Integrity requirements

- A Feature PI exists in the same scope. A Story Feature exists and its PI matches the Story PI.
- A Task Feature, when populated, exists and matches its PI.
- Sprint assignment resolves by `sprintId`; a duplicate sprint name can never choose a record.
- Dependencies contain unique task IDs in the same scope, never self-reference, and cannot create a cycle.
- Subtask/checklist/criterion values use an explicit validated shape such as `{ title: string, done: boolean }`; current rules only limit list size.
- `userStories.lifecycle` is the single persisted lifecycle source. Task fields retained for legacy display are derived/migrated, not independently editable.

## Security requirements

- Retain verified-email authentication unless a product decision changes it.
- Authorization lives in Firestore rules, not UI visibility.
- Named-project reads require current membership; writes require owner/editor; membership changes require owner.
- The Default Project’s current verified-user shared/creator-edit model must be expressly approved or replaced; do not alter it implicitly.
- Rules validate field allowlists, enums, bounds, immutable fields, and compatible parent links.
- Firestore rules cannot efficiently prove arbitrary graph-cycle freedom. Client write validation and a scheduled/read-only integrity audit are required.
- Never add privileged keys or credentials to the client/repository. Do not log unnecessary project or personal data.

## Reliability requirements

- Disable submit controls during writes; restore them in `finally`; present actionable errors.
- Document whether a multi-document action is atomic. Firestore batches are limited to 500 operations.
- Multi-batch propagation needs an idempotent resumable operation/manifest, visible partial failure, and retry instructions.
- Evaluate sequence allocation plus entity write for orphaned codes. Document acceptable gaps; never permit duplicate codes.
- Snapshots are deduplicated by scope, sprint ID, and local date and retain provenance. Reports tolerate days when the app was closed.
- Unsubscribe all real-time listeners on scope change/sign-out and clear stale scope state before render.

## UI, accessibility, and performance requirements

- Correct the duplicate `velocityChart` and `inProgressCount` IDs found in the audit.
- Preserve the established UI; remediation does not authorize a redesign.
- Dialogs require an accessible name, focus trap, initial and restored focus, keyboard Escape, and mobile overflow verification.
- Escape Firestore-derived content before `innerHTML`; retain regression coverage for untrusted strings.
- Before larger datasets, define pagination, bounded ranges, indexes, and dashboard aggregation. Do not keep assuming all tasks/stories fit in one client read.
- Select one authoritative membership-discovery path instead of redundant real-time discovery/fetches.
- Profile first authenticated load and set JavaScript/Firestore-read budgets. Current production build emits a 558.61 kB minified auth/Firebase chunk (166.23 kB gzip), above Vite’s 500 kB warning threshold. Split noncritical chart/knowledge/report code only after profiling.
- Each query documents expected cardinality, ordering, index, permissions, and read cost. The checked-in index file currently defines only a membership collection-group index.

## Verification plan

| Layer | Minimum coverage |
|---|---|
| Unit | ID helpers, normalizers, relationship resolver, validation, cycle detection, lifecycle mapping. |
| Firestore emulator | Verified/unverified access, owner/editor/viewer permissions, cross-project isolation, archived project, Default Project policy, allowed/denied writes. |
| Integration | Story create/edit/archive/title rename, sprint ID assignment, membership add/remove, multi-batch recovery. |
| DOM/accessibility | Unique IDs, labelled controls, dialog keyboard behaviour, errors, escaped content. |
| Browser/device | Authenticated desktop/mobile flows against intended Firebase environment with console/network review. |

### Checks actually run on 4 November 2026

- `npm test`: passed, 4 tests (business-ID helpers only).
- `npm run build`: passed with Vite 7.3.6; emitted the oversized-chunk warning above.
- Not run: Firestore emulator, live authentication, live data scan/change, rules deployment, or browser/device acceptance testing.

## Migration and operational procedure

1. Export relevant Firestore metadata/relationship fields read-only, retaining paths and IDs and avoiding unnecessary PII.
2. Report logical duplicates, dangling IDs/UIDs, cross-scope links, name ambiguity, invalid dates, and dependency integrity.
3. Generate deterministic dry-run manifests: path, before/after, reason, confidence, and rollback source.
4. Require owner review for ambiguous links; auto-map only unique, scope-valid matches.
5. Back up the exact scope immediately before bounded retry-safe write batches.
6. Re-run the report and authorization tests afterwards. Retain compatibility display fields until readers are ID-first.
7. Update `FIREBASE_DEPLOYMENT.md` and this document with every rule, path, or field-contract change. Existing deployment documentation contains stale task-field/access descriptions and cannot be the sole contract.

## Change-control guardrails

- Use the smallest compatible change. This TRD does not authorize a new architecture, package upgrade, Firebase service, collection, or UI redesign.
- Update rules, client validation, tests, and documentation together whenever the persisted contract changes.
- Never weaken Firestore rules to work around a client error.
- Report actual commands/results; a passing build does not prove authorization, migration, or browser correctness.
