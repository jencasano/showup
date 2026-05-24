import { db, storage } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { recordDiaryEvent } from "./event-write.js";

function entryDocId(yearMonth, day) {
  return `${yearMonth}-${String(day).padStart(2, "0")}`;
}

function entryRef(userId, yearMonth, day) {
  return doc(db, "diary", userId, "entries", entryDocId(yearMonth, day));
}

function storageRef(userId, yearMonth, day) {
  return ref(storage, `diary/${userId}/${entryDocId(yearMonth, day)}`);
}

export async function getDiaryEntry(userId, yearMonth, day) {
  const snap = await getDoc(entryRef(userId, yearMonth, day));
  return snap.exists() ? snap.data() : null;
}

export async function saveDiaryEntry(userId, yearMonth, day, { note, photoUrl }) {
  const data = {};
  if (note !== undefined)     data.note     = note;
  if (photoUrl !== undefined) data.photoUrl = photoUrl;
  data.lastUpdated = serverTimestamp();
  await setDoc(entryRef(userId, yearMonth, day), data, { merge: true });

  // Broadcast a save signal so screens that want to refresh on write
  // (e.g. the diary tab) can react without polling.
  window.dispatchEvent(new CustomEvent("diary:saved", {
    detail: { userId, yearMonth, day }
  }));

  // Persist the diary feed event. recordDiaryEvent decides between create
  // and edit based on whether the event doc already exists.
  const hasContent = (note !== undefined && note !== "") || photoUrl !== undefined;
  if (hasContent) {
    recordDiaryEvent(userId, yearMonth, day).catch(err =>
      console.error("Diary event write failed:", err)
    );
  }

  // Cross-month comeback tracking: roll lastActiveDate forward, preserving
  // the previous value as prevActiveDate. Fire-and-forget.
  (async () => {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    const oldLastActive = userSnap.exists() ? (userSnap.data().lastActiveDate || null) : null;
    const newLastActive = `${yearMonth}-${String(day).padStart(2, "0")}`;
    // Same-day re-save would clobber prevActiveDate with today.
    if (oldLastActive === newLastActive) return;
    await updateDoc(userRef, {
      prevActiveDate: oldLastActive,
      lastActiveDate: newLastActive
    });
  })().catch(() => {});
}

export async function uploadDiaryPhoto(userId, yearMonth, day, file) {
  const photoRef = storageRef(userId, yearMonth, day);
  await uploadBytes(photoRef, file);
  return getDownloadURL(photoRef);
}

export async function deleteDiaryPhoto(userId, yearMonth, day) {
  try {
    await deleteObject(storageRef(userId, yearMonth, day));
  } catch (err) {
    if (err.code !== "storage/object-not-found") throw err;
  }
}

export async function getDiaryCover(userId) {
  const snap = await getDoc(doc(db, "users", userId));
  if (!snap.exists()) return null;
  return snap.data().diaryCover || null;
}

export async function saveDiaryCover(userId, coverKey) {
  await setDoc(doc(db, "users", userId), { diaryCover: coverKey }, { merge: true });
}

export async function getMonthCover(userId, yearMonth) {
  const snap = await getDoc(doc(db, "logs", yearMonth, "entries", userId));
  if (!snap.exists()) return null;
  return snap.data().diaryCover || null;
}

export async function saveMonthCover(userId, yearMonth, coverKey) {
  await setDoc(
    doc(db, "logs", yearMonth, "entries", userId),
    { diaryCover: coverKey },
    { merge: true }
  );
}

export function getActiveCover(monthCover, userDefaultCover) {
  return monthCover || userDefaultCover || null;
}

export async function getDiaryDays(userId, yearMonth) {
  // List all docs in the entries subcollection and filter by yearMonth in JS.
  // Avoids __name__ query which requires a Firestore index and causes permission errors.
  const entriesRef = collection(db, "diary", userId, "entries");
  const snap = await getDocs(entriesRef);
  const days = new Set();
  snap.forEach(d => {
    // Doc IDs are like "2026-04-05" -- only include ones matching this yearMonth
    if (d.id.startsWith(yearMonth)) {
      const day = parseInt(d.id.split("-")[2], 10);
      if (!isNaN(day)) days.add(day);
    }
  });
  return days;
}
