# Firebase deployment

The planner uses Firebase Authentication, Cloud Firestore, and Firebase Hosting. It does not use Cloud Functions.

## Firestore collections

- `plannerTasks`: one document per task. The web app reads this collection in real time.
- `plannerUsers/{uid}`: each verified signed-in user's profile and optional UI preferences.

Task documents should use these normalized fields: `pi`, `piId`, `sprint`, `feature`, `featureId`, `storyId`, `userStory`, `task`, `assignee`, `description`, `app`, `storyPoints`, `capacity`, `startDate`, `endDate`, `sprintStartDate`, `sprintEndDate`, and `status`. Dates should be ISO-8601 strings. Status edits write the canonical `status` field.

The app reads `plannerTasks`. If existing Firestore data was created under a different collection or with another schema, migrate it before deployment; do not use permissive temporary rules.

## Access model

Any user authenticated with Firebase Authentication and a verified email address can read planner tasks, create a new task in the `To Do` column, and change a task's `status`. Deletion and edits to existing task details remain blocked by Firestore rules.

## Deploy

1. Install dependencies in the repository root with `npm install`.
2. In Firebase Console, enable Google and Email/Password sign-in and configure email verification.
3. Build with `npm run build`.
4. Deploy Hosting and Firestore rules with `firebase deploy --only hosting,firestore:rules --project project-palnner`.


## Sprint metadata

- Shared Default Project: `plannerSprints/{sprintId}`
- Named projects: `plannerProjects/{projectId}/sprints/{sprintId}`
- Each sprint stores `name`, `goal`, `startDate`, `endDate`, `capacity`, `status`, `archived`, `createdBy`, `createdAt`, and `updatedAt`.
- Deploy updated Firestore rules before using sprint create/edit/archive. Project members can read project sprints; project owners/editors can write them. Default-project sprint writes are limited to verified users and updates are restricted to the creator.
- Task assignments still store sprint names in the existing task `sprint` field. The UI prevents renaming a sprint while active tasks are assigned to it. Archiving preserves task assignments and does not delete tasks.


## Sprint analytics and daily history

Daily progress is stored at `plannerSprints/{sprintId}/dailySnapshots/{YYYY-MM-DD}` for the Default Project and `plannerProjects/{projectId}/sprints/{sprintId}/dailySnapshots/{YYYY-MM-DD}` for named projects. The app upserts one snapshot per sprint per local calendar day when it is open and sprint/task data refreshes; days with no app activity may have no snapshot. Historical actuals begin after deployment and are not backfilled. Deploy updated Firestore rules before enabling this feature.


## Sprint velocity and completion analytics

The Reports view summarizes historical sprint delivery using the daily snapshots stored under each sprint's `dailySnapshots` subcollection. The trend uses the latest snapshot on or before the sprint end date; completion rate is completed points divided by committed points. Average velocity includes only sprints whose status is Completed, Complete, Closed, or Done and that have a measurable snapshot on or before the end date. Sprints without such a snapshot display unavailable metrics rather than estimating historical results from today's task state. Snapshots are recorded while the planner is open and sprint/task data refreshes; this is not a scheduled backend job and history is not backfilled.
