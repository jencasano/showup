import { db, storage } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

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

export async function getDiaryTheme(userId) {
  const snap = await getDoc(doc(db, "users", userId));
  return snap.exists() ? (snap.data().diaryTheme ?? null) : null;
}

export async function saveDiaryTheme(userId, theme) {
  await setDoc(doc(db, "users", userId), { diaryTheme: theme }, { merge: true });
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
