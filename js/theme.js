// ═══════════════════════════════════════════════
// User theme persistence (Firestore)
// Backing field: users/{uid}.theme = "side-a" | "side-b"
// Per MIXTAPE_SPEC §11.
// ═══════════════════════════════════════════════

import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const VALID = new Set(["side-a", "side-b"]);

export async function getUserTheme(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  const value = snap.exists() ? snap.data().theme : null;
  return VALID.has(value) ? value : null;
}

export async function setUserTheme(uid, theme) {
  if (!VALID.has(theme)) return;
  await setDoc(doc(db, "users", uid), { theme }, { merge: true });
}
