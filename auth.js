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
  let profileName = user.displayName || "";
  if (!existing.exists()) {
    await setDoc(profileRef, {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      firstName: "",
      lastName: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else {
    profileName = profileName || existing.data().displayName || "";
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

  await ensureUserProfile(user);
  return { user, access: null, reason: null };
}

export async function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function createEmailAccount(email, password) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
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
