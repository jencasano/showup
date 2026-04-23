import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const DEFAULT_OWNED_COVERS = ["bold", "quiet", "moody"];
export const DEFAULT_OWNED_APP_THEMES = ["side-a", "side-b"];

export async function getOwnedCovers(uid) {
  if (!uid) return DEFAULT_OWNED_COVERS;
  try {
    const snap = await getDoc(doc(db, "entitlements", uid));
    if (!snap.exists()) return DEFAULT_OWNED_COVERS;
    const data = snap.data();
    return Array.isArray(data.diaryCovers) && data.diaryCovers.length
      ? data.diaryCovers
      : DEFAULT_OWNED_COVERS;
  } catch (err) {
    console.warn("getOwnedCovers: falling back to defaults", err);
    return DEFAULT_OWNED_COVERS;
  }
}

export async function seedEntitlementsIfMissing(uid) {
  if (!uid) return;
  const ref = doc(db, "entitlements", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    diaryCovers: [...DEFAULT_OWNED_COVERS],
    appThemes: [...DEFAULT_OWNED_APP_THEMES],
    stickerPacks: []
  });
}
