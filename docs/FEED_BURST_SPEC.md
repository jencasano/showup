# Feed Event Keying Spec

> Each debounce burst is its own event. Cards never merge across bursts.
> Companion to FEED_EVENT_SPEC.md and LOG_TIMESTAMP_SPEC.md.

---

## Problem

The current feed uses `{uid}-log-{dateStr}` as the event key. This forces one card per person per day. When a user marks an activity outside the debounce window (10 seconds), the existing card is replaced in place -- same key, updated content. This causes two issues:

1. Viewers who already saw the card don't notice the change. It looks like a duplicate.
2. The copy becomes stale. A comeback card that earned "broke a long quiet" on the first mark still shows comeback copy after the 5th mark an hour later, or worse, the card silently swaps to default copy and the comeback moment is lost.

---

## Design Principle

The unit is the event, not the day. Each debounce burst (a cluster of marks within 10 seconds of each other) produces one event card. That card is permanent -- it never gets replaced by a later burst. Later bursts produce their own cards.

A person can have multiple cards in the feed on the same day. Each card reflects what happened in that burst and the context at that moment.

---

## New Event Key

### Current
```
key: `${uid}-log-${dateStr}`
```
One key per person per day. Later events overwrite earlier ones.

### New
```
key: `${uid}-log-${batchId}`
```

`batchId` is derived from the timestamp of the first mark in the burst. Use the epoch millis from `markTimes` -- specifically the earliest timestamp in the current burst. This guarantees uniqueness per burst and stability across re-renders (same burst always produces the same key).

### How to determine batchId

The debouncer already collapses rapid marks into a single event. When the debounce timer expires and fires `onFeedEvent`, the burst is complete. At that point, scan `markTimes` for the marks that belong to this burst (timestamps within the last ~15 seconds). The minimum timestamp in that set is the batchId.

For the first snapshot (initial page load), all existing marks are treated as a single historical batch. Use the most recent `markTimes` timestamp as the batchId, or fall back to `lastUpdated` epoch, or fall back to `dateStr` for old docs without `markTimes`.

---

## Feed Behavior

### Within a debounce window (< 10 seconds between taps)
Same as today. Marks accumulate. One event fires when the window closes. One card rendered.

### Outside the debounce window (> 10 seconds between taps)
A new debounce window opens. When it closes, a NEW event fires with a new batchId. This produces a new card in the feed. The previous card remains untouched.

### Copy context per card
Each card independently evaluates its copy context via `computeSignal`. The first card of the day might earn comeback copy. Subsequent cards that day get default copy because the comeback moment has already passed (the user is now "active today" with multiple marks).

Note: `computeSignal` currently uses the full month's marks to determine context. For per-burst cards, it should still use the full month's marks for streak/comeback detection, but the activities displayed in the copy should only be the ones from THIS burst, not all marks for the day.

---

## What Changes

### js/feed-event.js (buildLogEvent)
- Accept an optional `batchId` parameter.
- Use `batchId` in the key instead of `dateStr`: `${uid}-log-${batchId}`.
- When batchId is not provided (initial load, old docs), derive it from the most recent markTimes timestamp or fall back to dateStr.

### js/tracker-following.js (onFeedEvent)
- Track which marks belong to the current burst vs. previously known marks.
- On initial load: build one event per person using all current marks (backward compatible).
- On real-time update (debounced): compare current marks against previously known marks to identify the new marks in this burst. Pass only the new activities to buildLogEvent. Generate a batchId from the new marks' timestamps.
- Store `knownMarks` per uid so future snapshots can diff against them.

### js/feed-event.js (renderFeedEvent)
- Accept a `burstActivities` list on the event object (activities logged in this specific burst).
- Use `burstActivities` for the activity name display instead of all marked activities.
- Use full marks for `computeSignal` context (streaks, comeback) but burst activities for the action line.

### js/following-feed.js (computeEventList)
- Stop deduplicating by uid+date. Multiple events per person per day are now expected.
- Sort all events by `firedAt` as before.

---

## Event Object Shape (updated)

```js
{
  type: "log",
  uid: "abc123",
  user: { ... },
  log: { ... },           // full log doc (for signal computation)
  burstActivities: ["No Rice"],  // NEW: only activities in this burst
  diaryEntry: null,
  dateStr: "2026-05-23",
  yearMonth: "2026-05",
  firedAt: 1779519200000,
  batchId: "1779519200000", // NEW: epoch millis of first mark in burst
  key: "abc123-log-1779519200000",  // NEW: uses batchId
}
```

---

## Edge Cases

### Page load with existing marks
All marks are treated as one historical batch. One card per person. batchId derived from the most recent markTimes value. This preserves the current "one card on load" behavior.

### User with no markTimes (old docs)
Fall back to current behavior: one card, key based on dateStr. No burst detection possible without timestamps.

### Unmark after a burst
Unmarking removes the mark from the log doc but does NOT remove the feed card that showed it. The card was a historical moment ("Jenii logged Workout") and the audit trail records the unmark separately. If all marks from a burst are removed, the card could show a "changed" message per FEED_SPEC.md, but this is deferred -- not required for v1 of this spec.

### Diary events
Diary events are unaffected. They already have natural uniqueness (one entry per day, no burst model). Key remains `{uid}-diary-{dateStr}`.

---

## Implementation Order

1. Update `buildLogEvent` to accept and use `batchId` in the key.
2. Add `burstActivities` to the event object.
3. Update `renderFeedEvent` to display `burstActivities` instead of all marks.
4. Update `onFeedEvent` in tracker-following.js to track known marks and diff on real-time updates.
5. Update `computeEventList` in following-feed.js to allow multiple events per person per day.
6. Test: two bursts from same user on same day produce two distinct cards with appropriate copy.

---

*Spec written May 2026. Companion to FEED_EVENT_SPEC.md and LOG_TIMESTAMP_SPEC.md.*
