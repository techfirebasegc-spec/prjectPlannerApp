#!/usr/bin/env node
/**
 * Permanently delete one planner project and all nested Firestore subcollections.
 *
 * Safety: dry-run by default. Destructive execution requires the exact project ID:
 *   npm run delete:project -- --project-name "The CliniQ" --confirm-project-id <PROJECT_ID>
 *
 * Authentication: set GOOGLE_APPLICATION_CREDENTIALS to a trusted Firebase Admin
 * service-account JSON file for the intended Firebase project.
 */
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
function argValue(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}
const requestedName = argValue("--project-name") || "The CliniQ";
const confirmedId = argValue("--confirm-project-id");
const normalizedName = requestedName.trim().toLocaleLowerCase();

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("Set GOOGLE_APPLICATION_CREDENTIALS to your Firebase Admin service-account JSON path.");
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const projectsSnapshot = await db.collection("plannerProjects").get();
const matches = projectsSnapshot.docs.filter((snapshot) => {
  const name = String(snapshot.get("name") || "").trim().toLocaleLowerCase();
  return name === normalizedName;
});

if (matches.length === 0) {
  console.log(`No project named "${requestedName}" was found. Nothing was deleted.`);
  process.exit(0);
}

console.log("Matching project(s):");
for (const project of matches) {
  console.log(`- name="${project.get("name")}" id="${project.id}" ownerId="${project.get("ownerId") || "unknown"}"`);
}

if (!confirmedId) {
  console.log("\nDRY RUN ONLY. Nothing was deleted.");
  console.log("Review the project ID above, then rerun with:");
  for (const project of matches) {
    console.log(`npm run delete:project -- --project-name "${requestedName}" --confirm-project-id ${project.id}`);
  }
  process.exit(0);
}

const target = matches.find((project) => project.id === confirmedId);
if (!target) {
  console.error("Safety check failed: the confirmed ID is not an exact name match. Nothing was deleted.");
  process.exit(1);
}
if (matches.length > 1) {
  console.error("Safety check failed: multiple projects have this name. Nothing was deleted. Resolve the duplicate names first.");
  process.exit(1);
}

const projectRef = db.collection("plannerProjects").doc(target.id);
const projectName = String(target.get("name") || "");
console.log(`\nAbout to permanently delete "${projectName}" (${target.id}) and its nested subcollections.`);

const userDocs = await db.collection("plannerUserProjects").get();
const pointers = [];
for (const userDoc of userDocs.docs) {
  const pointerRef = userDoc.ref.collection("projects").doc(target.id);
  const pointer = await pointerRef.get();
  if (pointer.exists) pointers.push(pointerRef);
}

console.log(`Found ${pointers.length} plannerUserProjects access pointer(s).`);
console.log("Deleting nested project data...");
await db.recursiveDelete(projectRef);

let deletedPointers = 0;
for (const pointerRef of pointers) {
  await pointerRef.delete();
  deletedPointers += 1;
}

const verification = await projectRef.get();
const remainingPointers = [];
for (const pointerRef of pointers) {
  if ((await pointerRef.get()).exists) remainingPointers.push(pointerRef.path);
}

if (verification.exists || remainingPointers.length > 0) {
  console.error("Deletion verification failed.");
  console.error(JSON.stringify({
    projectDocumentStillExists: verification.exists,
    remainingPointers
  }, null, 2));
  process.exit(2);
}

console.log("Deletion verified.");
console.log(JSON.stringify({
  projectName,
  projectId: target.id,
  deletedNestedDocuments,
  deletedAccessPointers: deletedPointers,
  projectDocumentStillExists: false
}, null, 2));
