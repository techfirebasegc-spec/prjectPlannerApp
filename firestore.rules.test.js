import test from "node:test";
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";

const projectId = "demo-cliniq-planner-rules";
const rules = readFileSync(new URL("./firestore.rules", import.meta.url), "utf8");
let testEnv;

const projectPath = (id) => `plannerProjects/${id}`;
const taskPath = (project, task) => `${projectPath(project)}/tasks/${task}`;

function context(uid, verified = true) {
  return testEnv.authenticatedContext(uid, {
    email: `${uid}@example.test`,
    email_verified: verified
  });
}

function taskData(createdBy) {
  return {
    task: "Confirm project permissions",
    code: "TASK-001",
    userStory: "",
    userStoryId: "",
    userStoryDescription: "",
    pi: "PI 1",
    piId: "pi-1",
    sprint: "",
    sprintId: "",
    feature: "Feature 1",
    featureId: "feature-1",
    assignee: "",
    assigneeUid: "",
    storyPoints: 3,
    priority: "MEDIUM",
    startDate: "2026-11-01",
    endDate: "2026-11-02",
    description: "",
    status: "To Do",
    archived: false,
    createdBy,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    subtasks: [],
    dependencies: [],
    acceptanceCriteria: []
  };
}

function sprintData(createdBy, memberCapacities = {}) {
  return {
    name: "Sprint 1",
    code: "SPR-001",
    goal: "Deliver the selected work",
    startDate: "2026-11-01",
    endDate: "2026-11-14",
    capacity: 20,
    memberCapacities,
    status: "PLANNED",
    archived: false,
    createdBy,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z"
  };
}

async function seedProject(project, owner, members = {}, archived = false) {
  await testEnv.withSecurityRulesDisabled(async (admin) => {
    const db = admin.firestore();
    await db.doc(projectPath(project)).set({
      name: project,
      description: "Rules test project",
      ownerId: owner,
      archived,
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-01T00:00:00.000Z"
    });
    await db.doc(`${projectPath(project)}/programIncrements/pi-1`).set({
      name: "PI 1",
      code: "PI-001",
      description: "",
      startDate: "2026-11-01",
      endDate: "2026-12-01",
      status: "PLANNED",
      archived: false,
      createdBy: owner,
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-01T00:00:00.000Z"
    });
    await db.doc(`${projectPath(project)}/features/feature-1`).set({
      name: "Feature 1",
      code: "FEAT-001",
      piId: "pi-1",
      pi: "PI 1",
      description: "",
      owner: "",
      ownerUid: "",
      priority: "MEDIUM",
      status: "PLANNED",
      archived: false,
      createdBy: owner,
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-01T00:00:00.000Z"
    });
    await Promise.all(Object.entries(members).map(([uid, role]) => db.doc(`${projectPath(project)}/members/${uid}`).set({
      uid,
      displayName: uid,
      role,
      addedAt: "2026-11-01T00:00:00.000Z"
    })));
  });
}

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules }
  });
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedProject("alpha", "owner", { editor: "editor", viewer: "viewer" });
  await seedProject("beta", "other-owner", { outsider: "editor" });
});

test.after(async () => {
  await testEnv.cleanup();
});

test("unauthenticated and unverified users cannot read named projects", async () => {
  const anonymous = testEnv.unauthenticatedContext().firestore();
  await assertFails(anonymous.doc(projectPath("alpha")).get());
  const unverified = context("owner", false).firestore();
  await assertFails(unverified.doc(projectPath("alpha")).get());
});

test("a viewer can read project work but cannot create a task", async () => {
  const viewer = context("viewer").firestore();
  await assertSucceeds(viewer.doc(projectPath("alpha")).get());
  await assertSucceeds(viewer.doc(`${projectPath("alpha")}/features/feature-1`).get());
  await assertFails(viewer.doc(taskPath("alpha", "viewer-task")).set(taskData("viewer")));
});

test("an editor can create work only in their own project", async () => {
  const editor = context("editor").firestore();
  await assertSucceeds(editor.doc(taskPath("alpha", "editor-task")).set(taskData("editor")));
  await assertFails(editor.doc(taskPath("beta", "cross-project-task")).set(taskData("editor")));
});

test("an editor can save optional individual sprint capacities in their project", async () => {
  const editor = context("editor").firestore();
  await assertSucceeds(editor.doc(`${projectPath("alpha")}/sprints/sprint-1`).set(sprintData("editor", { editor: 8, owner: 12 })));
  const viewer = context("viewer").firestore();
  await assertFails(viewer.doc(`${projectPath("alpha")}/sprints/viewer-sprint`).set(sprintData("viewer", { viewer: 5 })));
});

test("a non-member cannot read another project", async () => {
  const outsider = context("outsider").firestore();
  await assertFails(outsider.doc(projectPath("alpha")).get());
  await assertFails(outsider.doc(taskPath("alpha", "editor-task")).get());
});

test("archived projects deny member task access while the owner can archive", async () => {
  const owner = context("owner").firestore();
  await assertSucceeds(owner.doc(projectPath("alpha")).update({
    name: "alpha",
    description: "Rules test project",
    ownerId: "owner",
    archived: true,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:01.000Z"
  }));
  const viewer = context("viewer").firestore();
  await assertFails(viewer.doc(`${projectPath("alpha")}/features/feature-1`).get());
});
