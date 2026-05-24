// event-write.js -- Author-side writes to events/{uid}/items.
//
// Bursts are debounced: marks within BURST_QUIET_MS collapse into one event
// doc. Diary writes fire immediately, with editedAt updated on re-save.

import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, updateDoc,
  collection, query, where, limit, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { computeSignal } from "./following-signals.js";

const BURST_QUIET_MS = 10_000;

// uid -> { entries: [{activity, day, ts}], yearMonth, timerId }
const pendingBursts = new Map();

export function recordBurstMark(uid, yearMonth, day, activity, ts) {
  let pending = pendingBursts.get(uid);
  if (!pending) {
    pending = { entries: [], yearMonth, timerId: null };
    pendingBursts.set(uid, pending);
  }
  pending.entries.push({ activity, day, ts });
  if (pending.timerId) clearTimeout(pending.timerId);
  pending.timerId = setTimeout(() => flushBurst(uid), BURST_QUIET_MS);
}

export function recordBurstUnmark(uid, yearMonth, day, activity) {
  const pending = pendingBursts.get(uid);
  if (!pending) return;
  pending.entries = pending.entries.filter(
    e => !(e.activity === activity && e.day === day)
  );
  if (pending.entries.length === 0) {
    if (pending.timerId) clearTimeout(pending.timerId);
    pendingBursts.delete(uid);
  }
}

async function flushBurst(uid) {
  const pending = pendingBursts.get(uid);
  if (!pending || pending.entries.length === 0) {
    pendingBursts.delete(uid);
    return;
  }
  const { entries, yearMonth } = pending;
  pendingBursts.delete(uid);

  const batchId = Math.min(...entries.map(e => e.ts));
  const firedAt = Math.max(...entries.map(e => e.ts));
  const activities = [...new Set(entries.map(e => e.activity))];
  const latestDay = Math.max(...entries.map(e => e.day));
  const dateStr = `${yearMonth}-${String(latestDay).padStart(2, "0")}`;

  // Lock contextKey at write time so every viewer reads the same moment.
  const contextKey = await computeContextKey(uid, yearMonth, dateStr);

  const eventId = `burst-${batchId}`;
  try {
    await setDoc(doc(db, "events", uid, "items", eventId), {
      type: "burst",
      uid,
      firedAt,
      dateStr,
      yearMonth,
      batchId,
      activities,
      contextKey,
    });
  } catch (err) {
    console.error("Failed to write burst event:", err);
  }
}

async function computeContextKey(uid, yearMonth, dateStr) {
  try {
    const [userSnap, logSnap, existingSnap] = await Promise.all([
      getDoc(doc(db, "users", uid)),
      getDoc(doc(db, "logs", yearMonth, "entries", uid)),
      // Subsequent-burst lock: an earlier burst today already claimed the
      // moment. Query by dateStr only (single-field auto-index, no composite)
      // and filter for type="burst" client-side -- there are at most a handful
      // of events per day per user.
      getDocs(query(
        collection(db, "events", uid, "items"),
        where("dateStr", "==", dateStr),
        limit(10)
      )),
    ]);
    const hasEarlierBurst = existingSnap.docs.some(d => d.data().type === "burst");
    if (hasEarlierBurst) return "default";

    const userData = userSnap.exists() ? userSnap.data() : {};
    const logData  = logSnap.exists()  ? logSnap.data()  : null;
    const signal = computeSignal(userData.displayName || "", logData, {
      lastActiveDate: userData.lastActiveDate,
      prevActiveDate: userData.prevActiveDate,
    });
    return signal.contextKey || "default";
  } catch (err) {
    console.error("Could not compute contextKey, defaulting:", err);
    return "default";
  }
}

export async function recordSetupEvent(uid, yearMonth, activityCount) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const eventId = `setup-${yearMonth}`;
  try {
    await setDoc(doc(db, "events", uid, "items", eventId), {
      type: "setup",
      uid,
      firedAt: Date.now(),
      yearMonth,
      dateStr,
      activityCount,
    });
  } catch (err) {
    console.error("Failed to write setup event:", err);
  }
}

export async function recordDiaryEvent(uid, yearMonth, day) {
  const dateStr = `${yearMonth}-${String(day).padStart(2, "0")}`;
  const eventId = `diary-${dateStr}`;
  const ref = doc(db, "events", uid, "items", eventId);
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, { editedAt: serverTimestamp() });
    } else {
      await setDoc(ref, {
        type: "diary",
        uid,
        firedAt: Date.now(),
        dateStr,
        yearMonth,
        diaryDocId: dateStr,
        editedAt: null,
      });
    }
  } catch (err) {
    console.error("Failed to write diary event:", err);
  }
}
