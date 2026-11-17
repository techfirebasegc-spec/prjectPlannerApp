import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase.js";

export const USERS_COLLECTION = "plannerUsers";
export const DIRECTORY_COLLECTION = "plannerDirectory";
const INVITES_COLLECTION = "plannerInvites";
const ADMINS_COLLECTION = "plannerAdmins";
const REVOCATIONS_COLLECTION = "plannerAccountRevocations";

function normalizedEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function waitForAuthState() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export async function ensureUserProfile(user) {
  if (!user) return;

  const profileRef = doc(db, USERS_COLLECTION, user.uid);
  const existing = await getDoc(profileRef);
  const email = normalizedEmail(user.email);
  const inviteSnapshot = email ? await getDoc(doc(db, INVITES_COLLECTION, email)) : null;
  const invite = inviteSnapshot?.exists() ? inviteSnapshot.data() : null;
  const firstName = String(invite?.firstName || "").trim();
  const lastName = String(invite?.lastName || "").trim();
  let profileName = user.displayName || [firstName, lastName].filter(Boolean).join(" ");
  if (!existing.exists()) {
    await setDoc(profileRef, {
      uid: user.uid,
      email: user.email || "",
      displayName: profileName,
      firstName,
      lastName,
      role: invite?.role === "admin" ? "admin" : "normal",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else {
    profileName = profileName || existing.data().displayName || "";
  }
  if (invite?.role === "admin") {
    const adminRef = doc(db, ADMINS_COLLECTION, user.uid);
    const adminSnapshot = await getDoc(adminRef);
    if (!adminSnapshot.exists()) {
      await setDoc(adminRef, {
        uid: user.uid,
        email: user.email || "",
        displayName: profileName || "Unnamed user",
        grantedBy: String(invite.createdBy || "invitation"),
        grantedAt: serverTimestamp()
      });
    }
  }
  await setDoc(doc(db, DIRECTORY_COLLECTION, user.uid), {
    uid: user.uid,
    displayName: profileName || "Unnamed user",
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function getAuthenticatedPlannerUser() {
  const user = await waitForAuthState();
  if (!user) return { user: null, access: null, reason: "signed-out" };

  if (!user.emailVerified) return { user, access: null, reason: "email-unverified" };

  const revoked = await getDoc(doc(db, REVOCATIONS_COLLECTION, user.uid));
  if (revoked.exists()) return { user, access: null, reason: "access-revoked" };

  await ensureUserProfile(user);
  return { user, access: null, reason: null };
}

export async function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, normalizedEmail(email), password);
}

export async function createEmailAccount(email, password) {
  const credential = await createUserWithEmailAndPassword(auth, normalizedEmail(email), password);
  await sendEmailVerification(credential.user);
  return credential;
}

export async function signInWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  await ensureUserProfile(credential.user);
  return credential;
}

export async function resendVerification() {
  if (auth.currentUser) await sendEmailVerification(auth.currentUser);
}

export async function signOutUser() {
  await signOut(auth);
}

export async function updatePlannerProfile(firstName, lastName) {
  const user = auth.currentUser;
  if (!user) throw new Error("No signed-in user.");
  const displayName = [firstName, lastName].filter(Boolean).join(" ");
  await updateProfile(user, { displayName });
  try {
    await updateDoc(doc(db, USERS_COLLECTION, user.uid), {
      firstName,
      lastName,
      displayName,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    // Firebase Authentication remains the source of truth for the visible name.
    console.warn("Could not mirror the profile name to Firestore", error);
  }
  await setDoc(doc(db, DIRECTORY_COLLECTION, user.uid), {
    uid: user.uid,
    displayName,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return { displayName };
}
