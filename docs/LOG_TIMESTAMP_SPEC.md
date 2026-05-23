# Log Timestamp & Audit Spec

> Closes the audit gap that made the May 15 ghost marks uninvestigable.
> Companion to FEED_EVENT_SPEC.md (which needs per-mark timing for proper event dating).

---

## Problem

1. Marks have no timestamp -- we can't tell when a specific day was marked.
2. Only `toggleDay` writes `lastUpdated`. Month setup, manage-activities, and any future write path skip it.
3. No `createdAt` on log docs -- we infer creation from `setupDay` (a bare number with no date or time).
4. Month setup uses `{ merge: true }`, which can silently preserve stale marks from a partial doc.
5. No record of unmarks -- once a mark is removed, it's gone with no trace.

---

## 1. Per-mark timestamps

### Current schema

```
marks: {
  "Workout": [4, 10, 15],
  "8hr Sleep": [4, 15]
}
```

Each value is an array of day-of-month integers. No timing info.

### New schema

```
marks: {
  "Workout": [4, 10, 15],
  "8hr Sleep": [4, 15]
}

markTimes: {
  "Workout": { "4": 1715750400000, "10": 1716264000000, "15": 1716696000000 },
  "8hr Sleep": { "4": 1715750400000, "15": 1716696000000 }
}
```

`markTimes` is a parallel map. Keys are activity names, values are objects mapping day number (as string key) to epoch millis timestamp of when the mark was created.

Why a separate field instead of changing `marks`:
- `marks` stays backward-compatible -- every read path that uses it today keeps working with zero changes.
- `markTimes` is additive. Old docs without it simply have no timing info, which is fine.
- The `marks` arrays are used heavily for rendering (streak calc, calendar grid, stats). Keeping them as simple int arrays avoids refactoring every consumer.

### Write behavior

- When a mark is added: set `markTimes[activity][day] = Date.now()`.
- When a mark is removed: delete `markTimes[activity][day]`.
- On month setup (new doc): `markTimes` starts as `{}` (empty, matching `marks: {}`).

### Read behavior for the feed

When building a feed event, the most recent timestamp in `markTimes` across all activities tells the feed:
- What day the most recent mark was for (the day key).
- When the mark was actually created (the timestamp value).
- Whether it's a backfill (mark timestamp is after the marked day's calendar date).

---

## 2. `lastUpdated` on all write paths

Every Firestore write to a log doc must include `lastUpdated: serverTimestamp()`.

### Files that need changes

| File | Write path | Currently writes `lastUpdated`? |
|---|---|---|
| `js/tracker-mylog.js` | `toggleDay` (mark/unmark) | Yes |
| `js/month-setup.js` | Setup save (`setDoc` with merge) | No -- add it |
| `js/manage-activities.js` | `doSave` (rename/delete/add activities) | No -- add it |

Any future write path to log docs must include `lastUpdated: serverTimestamp()` as a mandatory field.

---

## 3. `createdAt` on log docs

Add `createdAt: serverTimestamp()` when a log doc is first created. This only happens in month-setup.js on the initial `setDoc`. The `toggleDay` path uses `updateDoc` for existing docs, so `createdAt` stays untouched after the first write.

If the doc already exists (e.g. `manage-activities` updating an existing month), `createdAt` is NOT overwritten. Use `merge: true` or conditional logic to protect it.

### Relationship to `setupDay`

`setupDay` remains as a convenience field (day-of-month integer). `createdAt` adds the full timestamp. Both are written on setup. `setupDay` is used for the "Start day" / "Join day" legend on the tracker grid. `createdAt` is for audit.

---

## 4. Fix `{ merge: true }` on month setup

### Current behavior

```js
await setDoc(
  doc(db, "logs", yearMonth, "entries", userId),
  entryData,   // includes marks: {}
  { merge: true }
);
```

With `merge: true`, an empty `marks: {}` does NOT clear existing marks nested inside `marks`. It merges at the top level, leaving any pre-existing `marks.Workout`, `marks.Sleep`, etc. intact.

### Fix

Drop `{ merge: true }` entirely. Use a plain `setDoc` (no merge). This overwrites the entire doc cleanly.

This is safe because month setup already builds the complete doc shape before writing -- activities, cadences, marks, decoration, displayName, everything. Nothing is lost.

**Important: this does NOT affect the carry-forward behavior.** The setup modal still loads last month's data via `checkMonthlySetup` and pre-fills the form with previous activities, cadences, and decoration. The user sees all their old settings, tweaks or accepts them, and hits Save. That carry-forward is a read operation that happens before the write. The merge fix only changes the final Firestore write -- ensuring that if a partial or stale doc somehow already exists at this month's path, it gets cleanly replaced instead of silently merging leftover data on top of the new doc.

### Same fix for `markTimes`

The setup save writes `markTimes: {}` alongside `marks: {}`. With the merge fix, both start clean.

---

## 5. Audit subcollection

### Path

```
logs/{yearMonth}/entries/{uid}/audit/{autoId}
```

Each toggle (mark or unmark) writes a small audit doc alongside the mark update.

### Schema

```json
{
  "activity": "Workout",
  "day": 15,
  "action": "mark",
  "timestamp": <serverTimestamp>,
  "clientTime": 1716696000000
}
```

| Field | Type | Description |
|---|---|---|
| `activity` | string | Activity name at time of toggle |
| `day` | number | Day of month (1-31) |
| `action` | string | `"mark"` or `"unmark"` |
| `timestamp` | Firestore timestamp | Server-authoritative write time |
| `clientTime` | number | `Date.now()` from the client, for cross-referencing |

### Write behavior

- `toggleDay` in `tracker-mylog.js`: after updating the mark, add a doc to the audit subcollection. This is fire-and-forget -- don't await it or let it block the UI.
- `manage-activities.js`: when an activity is deleted (which removes marks), write one audit doc per removed mark with action `"unmark"` and a note field: `"reason": "activity-deleted"`. Also fire-and-forget.
- Month setup: no audit needed -- the doc is being created fresh with empty marks.

### Read behavior

The audit subcollection is NOT read during normal app usage. It exists for:
- Debugging (Firebase console, admin tools).
- Future "mark history" feature if we ever build it.
- Investigating situations exactly like the ghost marks mystery.

### Firestore rules

```
match /logs/{yearMonth}/entries/{userId}/audit/{auditId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow create: if request.auth != null && request.auth.uid == userId;
  allow update, delete: if false;
}
```

Audit docs are append-only. The user can create them and read their own, but nobody can edit or delete them. This ensures the trail is tamper-proof.

---

## Implementation order

1. **Firestore rules** -- add the audit subcollection rules. Deploy rules first so writes don't get rejected.
2. **`tracker-mylog.js` (`toggleDay`)** -- add `markTimes` write alongside existing `marks` write. Add audit doc write (fire-and-forget).
3. **`month-setup.js`** -- add `createdAt`, `lastUpdated`, and `markTimes: {}` to the setup save. Remove `{ merge: true }` (use clean `setDoc`).
4. **`manage-activities.js`** -- add `lastUpdated` to the save. On activity deletion, write audit docs for removed marks. Carry `markTimes` alongside `marks` on rename.
5. **Feed event builder** -- update `tracker-following.js` and `feed-event.js` to read `markTimes` for proper event dating. Fall back gracefully for old docs without `markTimes`.

### Migration

No data migration needed. Old docs without `markTimes`, `createdAt`, or audit history simply lack that data. All read paths fall back gracefully. New marks on old docs will start populating `markTimes` going forward.

---

*Spec written May 2026. Companion to FEED_EVENT_SPEC.md and FOLLOWING_SPEC.md.*
