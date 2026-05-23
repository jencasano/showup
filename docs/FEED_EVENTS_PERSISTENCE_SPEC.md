# Feed Events Persistence Spec

> Promote bursts and diary entries to first-class persisted documents. The feed becomes a query over events instead of a viewer-side projection over log/diary docs.
> Companion to FEED_EVENT_SPEC.md, FEED_BURST_SPEC.md, and LOG_TIMESTAMP_SPEC.md.

---

## Problem

Bursts today exist only in viewer memory (the `knownMarks` diff in `tracker-following.js`). On page refresh, all per-burst history collapses into one historical card per person per day. Multi-burst chronology is observer-relative: it's only real while the viewer is watching live.

This blocks three things:

1. **A true chronological timeline.** Refresh shouldn't erase the feed.
2. **Cross-viewer consistency.** Two followers watching the same person should see the same cards.
3. **Future feed types.** User-written posts, likes, comments, and permalinks all assume "an event" is a thing that exists in storage, not a projection that has to be re-derived each session.

---

## Design Principle

The event is a stored fact written once, by the author, at the moment it happens. The feed is a query over those facts. Viewer-side derivation goes away.

A burst is determined and persisted by the author when their debounce window closes. Every viewer reads the same document. The viewer no longer needs `knownMarks` or per-snapshot diffing. Those concerns move to the author's write path.

---

## Schema

### Path

```
events/{uid}/items/{eventId}
```

Per-user subcollection. Owner writes, followers read. Account delete is a single subtree drop. The path itself encodes ownership, which keeps security rules trivial.

### Document shape

```js
{
  type: "burst" | "diary",
  uid: "abc123",                    // duplicated for query/render convenience
  firedAt: 1779519200000,           // ms epoch, primary sort key
  dateStr: "2026-05-23",            // YYYY-MM-DD the activity is for
  yearMonth: "2026-05",

  // burst-only
  batchId: 1779519200000,           // ms epoch of first mark in burst
  activities: ["No Rice"],          // activity names in this burst
  contextKey: "comeback_big" | "default" | "streak_7" | ...,
                                    // copy context locked at write time

  // diary-only
  diaryDocId: "2026-05-23",         // pointer to diary/{uid}/entries/{docId}
  editedAt: 1779519200000 | null,   // set if the diary entry was edited after first save
}
```

The full diary content (note, photoUrl) stays in the diary doc. The event is just a pointer plus enough metadata to render the card and sort it into the timeline.

### Event IDs

Deterministic IDs make writes idempotent. A retried write from the same burst can't create a duplicate.

- Bursts: `burst-{batchId}` (e.g. `burst-1779519200000`)
- Diary: `diary-{dateStr}` (e.g. `diary-2026-05-23`)

---

## Security Rules

```
match /events/{ownerUid}/items/{eventId} {
  allow read: if request.auth.uid == ownerUid
           || (request.auth != null
               && ownerUid in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.following);
  allow create: if request.auth.uid == ownerUid;
  allow update: if request.auth.uid == ownerUid
             && resource.data.type == "diary";  // diary can be re-saved on edit
  allow delete: if false;                       // events are immutable history
}
```

Privacy tier (`privacy.calendar`, `privacy.diary`) stays a client-side filter for now, matching the current pattern. Rules-level enforcement is future hardening.

---

## Write Path

### Bursts (author-side)

Wherever the author's mark-activity code commits log marks today, after the debounce window closes:

1. Compute burst metadata: `activities`, `batchId` (min ts in burst), `firedAt` (max ts in burst), `dateStr` (latest day in burst).
2. Compute `contextKey` via `computeSignal`, using the author's full log doc + user meta.
3. If an event with `dateStr` already exists for this uid today (query `events/{uid}/items` where `dateStr == today` limit 1), lock `contextKey` to `"default"`. This is the "subsequent burst" rule from FEED_BURST_SPEC.md, but enforced at the write site instead of per-viewer.
4. `setDoc(doc(db, "events", uid, "items", "burst-" + batchId), {...})`.

The author writes once. Every follower reads the same doc.

### Diary (author-side)

Wherever diary entries are saved:

1. On create: `setDoc(doc(db, "events", uid, "items", "diary-" + dateStr), { type: "diary", ..., editedAt: null })`.
2. On edit: same path, with `editedAt: serverTimestamp()` and updated `firedAt` if you want edits to bump position (probably not).

### Idempotency

Deterministic IDs plus the debouncer's "fire once when the quiet window closes" semantics make duplicate events impossible. A network retry just overwrites the same doc with the same data.

---

## Read Path

### Viewer subscribes per followed user

Replace the per-user log/diary listeners in `tracker-following.js` with per-user events listeners:

```js
const eventsRef = collection(db, "events", uid, "items");
const q = query(eventsRef, where("firedAt", ">", sinceMs), orderBy("firedAt", "desc"), limit(50));
onSnapshot(q, (snap) => {
  for (const change of snap.docChanges()) {
    if (change.type === "added" || change.type === "modified") {
      mergeEventIntoFeed(change.doc.data());
    } else if (change.type === "removed") {
      removeEventFromFeed(change.doc.id);
    }
  }
});
```

`sinceMs` scopes initial read cost (e.g. last 7 days). Older events load on scroll or via a "show earlier" affordance.

### Removed concerns (viewer)

- `knownMarks` map: gone. Burst identity lives in the event doc.
- In-memory diffing in `onFeedEvent`: gone.
- `buildLogEvent` / `buildDiaryEvent` synthesis: gone. The doc is the event.
- Per-burst contextKey lock check: gone. Decided at write time.

### Kept concerns

- The log doc listener is still useful for non-feed views (calendar, streak counter, people view). It just no longer drives the feed.
- `computeSignal` is still called, but on the author side at write time, to compute the `contextKey` snapshot.
- `renderFeedEvent` is mostly unchanged: dispatches on `event.type`, reads `burstActivities` / `contextKey` / `firedAt` directly off the event doc.

---

## Migration

Live users (e.g. Jenii, Neithan in current data) already have log and diary docs but no events. Use a two-mode read fallback:

1. On viewer load, for each followed user, query their events collection with the window.
2. **If events exist**, render only from events.
3. **If events are empty**, fall back to the current log/diary projection (one historical card per person, the way it works today).

New writes always go through the events path. Over time, all activity is events-backed. No data migration required; the transition is gradual and lossless.

Optional one-time backfill: a Cloud Function or admin script that scans each user's `markTimes`, clusters by >10s gaps, and writes reconstructed burst events. Lossy where users unmarked (timestamp is gone from markTimes), otherwise clean. Defer unless reconstructing historical chronology becomes important.

---

## Edge Cases

### Unmark after a burst
The event doc stays as a historical moment (matches FEED_BURST_SPEC.md v1 behavior). The audit trail records the unmark on the log doc; the event card is not modified.

### Account delete
Recursive delete of `events/{uid}` via Cloud Function or admin script. Same pattern already needed for `logs`, `diary`, `users`.

### Privacy tier change
Events from a user who flips to `private` are still in storage but filtered at render time on the viewer. Rules-level filtering is future work.

### Diary edit
Update the existing `diary-{dateStr}` event with `editedAt`. The renderer can show an "edited" marker (already supported in `renderFeedEvent`).

### Multi-day burst (backfill within one debounce window)
`dateStr` reflects the latest day in the burst (existing FEED_BURST_SPEC.md behavior). Marks for past days still get attributed to those days in the log doc; the event records the moment of logging.

### Author has no followers yet
Events still get written. They're just unread until someone follows the author. No special-casing needed, and follow-then-see-recent-events just works.

### Two devices, same author, near-simultaneous bursts
Both devices compute the same `batchId` only if they share the debouncer state. They don't. Cross-device near-simultaneous bursts produce two event docs with different IDs (different first-mark timestamps). Acceptable: the cards interleave on the timeline. Not worth coordinating.

---

## Future Extensibility

The same shape generalizes naturally without new collections or schema migrations:

- **User-written posts**: `type: "post"`, plus a `text` field (and maybe `mediaUrls`). Same path, same listeners, renderer dispatches on type.
- **Milestones**: `type: "milestone"`, plus the milestone payload (e.g. "30-day streak").
- **Likes / reactions**: subcollection on the event (`events/{uid}/items/{eventId}/reactions/{actorUid}`).
- **Comments**: subcollection (`events/{uid}/items/{eventId}/comments/{commentId}`).
- **Notifications**: a Cloud Function on event-create dispatches per-type notification payloads.
- **Permalinks**: `/event/{uid}/{eventId}` resolves to a single doc fetch.
- **Fan-out timeline** (if follow counts ever scale): a Cloud Function writes pointers into `timelines/{viewerUid}/items/{eventId}` per follower. Viewer feed becomes a single query against their own timeline. Storage layer is untouched; this is purely an added index.

These all build on top of the events collection without modifying it.

---

## Implementation Order

1. **Schema + rules**: deploy security rules for `events/{uid}/items` to firestore.rules.
2. **Burst write**: in the author's mark-activity write path, after debounce-close, write a `burst-{batchId}` event with `activities`, `firedAt`, `dateStr`, and `contextKey` (computed with the subsequent-burst lock).
3. **Diary write**: in the diary-save path, write a `diary-{dateStr}` event on create and update it on edit.
4. **Viewer read**: in `tracker-following.js`, add an events listener per followed user; merge events into `feedEvents` directly via `docChanges()`.
5. **Migration fallback**: keep the existing log/diary projection as a fallback when a followed user has zero events.
6. **Cleanup**: remove `knownMarks`, the in-memory diff logic, and the per-viewer "subsequent burst" lock from `tracker-following.js` / `feed-event.js` (they now live at write time).
7. **Test**: refresh after multiple bursts (cards persist); pre-migration user (fallback path); new user on first day; user with privacy change mid-session; two followers see the same cards.

---

*Spec written May 2026. Companion to FEED_EVENT_SPEC.md, FEED_BURST_SPEC.md, and LOG_TIMESTAMP_SPEC.md.*
