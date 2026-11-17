import test from "node:test";
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";

const projectId = "demo-cliniq-planner-rules";
const bootstrapAdminUid = "UosH0j7JVLYCKYwTYOeAJXqk7Ge2";
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

function taskUpdateData(projectId, taskId, authorUid) {
  return {
    taskId,
    projectId,
    taskName: "Shared task",
    body: "Completed the first daily update.",
    authorUid,
    authorName: authorUid,
    createdAt: new Date("2026-11-05T09:00:00.000Z")
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
    await db.doc(`${projectPath(project)}/userStories/story-1`).set({ title: "Shared story" });
    await db.doc(`${projectPath(project)}/sprints/sprint-1`).set({ name: "Shared sprint" });
    await db.doc(taskPath(project, "task-1")).set({ task: "Shared task" });
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

test("an administrator can grant a normal user project membership records", async () => {
  const admin = context(bootstrapAdminUid).firestore();
  await assertSucceeds(admin.doc(`${projectPath("alpha")}/members/outsider`).set({
    uid: "outsider",
    displayName: "outsider",
    role: "viewer",
    addedAt: new Date("2026-11-05T09:00:00.000Z")
  }));
  await assertSucceeds(admin.doc("plannerUserProjects/outsider/projects/alpha").set({
    role: "viewer",
    addedAt: new Date("2026-11-05T09:00:00.000Z")
  }));
});

test("a project access revocation blocks a member while administrators retain project access", async () => {
  await testEnv.withSecurityRulesDisabled(async (admin) => {
    await admin.firestore().doc(`${projectPath("alpha")}/accessRevocations/viewer`).set({ uid: "viewer" });
  });
  const viewer = context("viewer").firestore();
  const admin = context(bootstrapAdminUid).firestore();
  await assertFails(viewer.doc(taskPath("alpha", "task-1")).get());
  await assertSucceeds(admin.doc(taskPath("alpha", "task-1")).get());
});

test("task updates are readable by project members, writable by editors, and immutable", async () => {
  const updatePath = `${taskPath("alpha", "task-1")}/updates/update-1`;
  const editor = context("editor").firestore();
  const viewer = context("viewer").firestore();
  await assertSucceeds(editor.doc(updatePath).set(taskUpdateData("alpha", "task-1", "editor")));
  await assertSucceeds(viewer.doc(updatePath).get());
  await assertSucceeds(viewer.collection(`${taskPath("alpha", "task-1")}/updates`).where("projectId", "==", "alpha").orderBy("createdAt", "desc").get());
  await assertFails(viewer.doc(`${taskPath("alpha", "task-1")}/updates/viewer-update`).set(taskUpdateData("alpha", "task-1", "viewer")));
  await assertFails(editor.doc(updatePath).update({ body: "A changed entry" }));
  await assertFails(editor.doc(updatePath).delete());
});

test("a project member can query their project task-update feed only", async () => {
  await testEnv.withSecurityRulesDisabled(async (admin) => {
    const db = admin.firestore();
    await db.doc(`${taskPath("alpha", "task-1")}/updates/alpha-update`).set(taskUpdateData("alpha", "task-1", "editor"));
    await db.doc(`${taskPath("beta", "task-1")}/updates/beta-update`).set(taskUpdateData("beta", "task-1", "outsider"));
  });
  const viewer = context("viewer").firestore();
  await assertSucceeds(viewer.collectionGroup("updates").where("projectId", "==", "alpha").orderBy("createdAt", "desc").get());
  await assertFails(viewer.collectionGroup("updates").where("projectId", "==", "beta").orderBy("createdAt", "desc").get());
});

test("a member with a legacy project-access record can read every shared work type", async () => {
  await testEnv.withSecurityRulesDisabled(async (admin) => {
    const db = admin.firestore();
    await db.doc(`${projectPath("alpha")}/members/viewer`).delete();
    await db.doc(`plannerUserProjects/viewer/projects/alpha`).set({
      role: "viewer",
      addedAt: "2026-11-01T00:00:00.000Z"
    });
  });

  const viewer = context("viewer").firestore();
  await assertSucceeds(viewer.doc(`${projectPath("alpha")}/programIncrements/pi-1`).get());
  await assertSucceeds(viewer.doc(`${projectPath("alpha")}/features/feature-1`).get());
  await assertSucceeds(viewer.doc(`${projectPath("alpha")}/userStories/story-1`).get());
  await assertSucceeds(viewer.doc(`${projectPath("alpha")}/sprints/sprint-1`).get());
  await assertSucceeds(viewer.doc(taskPath("alpha", "task-1")).get());
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

test("the bootstrap administrator can read every named project", async () => {
  const admin = context(bootstrapAdminUid).firestore();
  await assertSucceeds(admin.doc(projectPath("alpha")).get());
  await assertSucceeds(admin.doc(projectPath("beta")).get());
  await assertSucceeds(admin.doc(`${projectPath("beta")}/features/feature-1`).get());
});

test("a project revocation blocks an owner while keeping administrator access", async () => {
  await testEnv.withSecurityRulesDisabled(async (admin) => {
    await admin.firestore().doc(`${projectPath("alpha")}/accessRevocations/owner`).set({ uid: "owner" });
  });
  const owner = context("owner").firestore();
  const admin = context(bootstrapAdminUid).firestore();
  await assertFails(owner.doc(projectPath("alpha")).get());
  await assertFails(owner.doc(`${projectPath("alpha")}/features/feature-1`).get());
  await assertSucceeds(admin.doc(`${projectPath("alpha")}/features/feature-1`).get());
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
