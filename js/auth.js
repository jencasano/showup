import { auth, db } from "./firebase-config.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const provider = new GoogleAuthProvider();

// Sign in with Google
export async function signIn() {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Sign in error:", error);
  }
}

// Sign out
export async function signOutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign out error:", error);
  }
}

// Listen to auth state changes
export function onAuthReady(callback) {
  onAuthStateChanged(auth, callback);
}

// Check if user has completed setup
export async function hasCompletedSetup(userId) {
  const userDoc = await getDoc(doc(db, "users", userId));
  return userDoc.exists() && userDoc.data().setupComplete === true;
}