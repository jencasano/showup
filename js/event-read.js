// event-read.js -- Viewer-side subscription to a single user's events.
//
// Each followed user gets one onSnapshot listener over their events/{uid}/items
// subcollection. New/changed/removed events are delivered as normalized records
// ready to merge into the feed. The renderer joins user/log/diary state from
// the tracker's caches.

import { db } from "./firebase-config.js";
import {
  collection, query, where, orderBy, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const WINDOW_DAYS = 30;
const EVENT_LIMIT = 50;

export function subscribeToUserEvents(uid, onAdd, onRemove) {
  const sinceMs = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const eventsRef = collection(db, "events", uid, "items");
  const q = query(
    eventsRef,
    where("firedAt", ">", sinceMs),
    orderBy("firedAt", "desc"),
    limit(EVENT_LIMIT),
  );
  return onSnapshot(q, (snap) => {
    for (const change of snap.docChanges()) {
      const event = normalizeEvent(change.doc.id, change.doc.data());
      if (change.type === "removed") onRemove(event);
      else onAdd(event);
    }
  }, (err) => {
    console.error("Events snapshot error for uid", uid, err);
  });
}

// Shape a Firestore event doc into the same field set the renderer expects.
// burstActivities + lockedContext line up with the existing in-memory shape
// so renderFeedEvent doesn't need to branch on persistence source.
function normalizeEvent(eventId, data) {
  return {
    eventId,
    type: data.type,
    uid: data.uid,
    firedAt: data.firedAt,
    dateStr: data.dateStr,
    yearMonth: data.yearMonth,
    batchId: data.batchId || null,
    burstActivities: data.activities || null,
    lockedContext: data.contextKey || null,
    diaryDocId: data.diaryDocId || null,
    editedAt: data.editedAt || null,
    // eventId is "burst-{batchId}" or "diary-{dateStr}". Resulting key
    // matches the legacy buildDiaryEvent key shape so event-doc diary
    // entries deduplicate naturally with any legacy diary card.
    key: `${data.uid}-${eventId}`,
  };
}
