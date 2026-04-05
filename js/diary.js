import { db, storage } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, setDoc, query, where
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

export async function getDiaryDays(userId, yearMonth) {
  const entriesRef = collection(db, "diary", userId, "entries");
  const q = query(
    entriesRef,
    where("__name__", ">=", `${yearMonth}-01`),
    where("__name__", "<=", `${yearMonth}-31`)
  );
  const snap = await getDocs(q);
  const days = new Set();
  snap.forEach(d => {
    const day = parseInt(d.id.split("-")[2], 10);
    if (!isNaN(day)) days.add(day);
  });
  return days;
}
