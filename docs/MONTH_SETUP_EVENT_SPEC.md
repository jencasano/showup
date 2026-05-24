# Feed Event: Month Setup

> A new event type that fires when a user completes their initial monthly setup.
> Companion to FEED_EVENT_SPEC.md and MILESTONE_CARD_SPEC.md.

---

## Overview

When a user completes the monthly setup modal (picking activities and cadences for a new month), a setup event is written to their events collection. Followers see a card in the feed that signals commitment to the new month. It is a rhythm marker, not a milestone.

The setup event is intentionally abstract. It does not reveal which activities the user picked or how many. The feed tells you someone committed. What they committed to reveals itself through their daily log cards.

---

## Trigger

The event fires once per user per month: when the Save handler in js/month-setup.js successfully writes the log doc to `logs/{yearMonth}/entries/{uid}`. The event is written immediately after the setDoc succeeds, before the overlay closes.

Re-setup (editing activities mid-month via Manage Activities) does NOT fire a setup event. Only the initial monthly setup does.

To prevent duplicates, the eventId is deterministic: `setup-{yearMonth}`. A second save for the same month (edge case: user re-enters setup after clearing their log) overwrites the same event doc rather than creating a new one.

---

## Firestore

**Path:** `events/{uid}/items/setup-{yearMonth}`

**Document shape:**

```
{
  type: "setup",
  uid: string,
  firedAt: number (Date.now()),
  yearMonth: string (e.g. "2026-05"),
  dateStr: string (e.g. "2026-05-01", the day setup was completed),
  activityCount: number (how many activities were picked, for future use)
}
```

activityCount is stored for potential future copy variants ("tracking 5 things this month") but is not used in the initial implementation.

---

## Event Write

Add a new exported function to js/event-write.js:

`recordSetupEvent(uid, yearMonth, activityCount)`

This writes (or overwrites) the setup event doc at the deterministic path. No debounce needed since setup only happens once.

---

## Copy

New keys added to data/signal-copy.json following the existing pattern: `feed_{tier}_setup_default_{variant}`

Three tiers, one context (default), multiple variants per tier.

### Sharing tier

Warm, specific, names the person and the month.

- "{firstName} is set up for {month}. Let's see what happens."
- "{firstName} locked in for {month}. New month, new page."
- "{firstName} is ready for {month}."
- "New month for {firstName}. The board is set."

### Low key tier

Insight-level, names the person, no specifics.

- "{firstName} is getting ready for something."
- "A new month is starting for {firstName}."
- "{firstName} set the table. Now it's time to show up."

### Ghost tier

Poetic absence, names the person (ghost copy uses {firstName} per existing convention), closed-door.

- "{firstName} turned a new page. Quietly."
- "A new month began for {firstName}. The details are theirs."
- "{firstName} set something up. We won't know what."

### Template variables

- `{firstName}` -- first name, resolved at render time
- `{month}` -- formatted month name (e.g. "May 2026"), resolved at render time

The `{month}` variable is new. fillFeedCopy in js/feed-copy.js needs to handle it.

---

## Renderer

In js/feed-event.js, add handling for `type: "setup"` events.

### Build function

Add `buildSetupEvent(uid, user, yearMonth, firedAt)` to feed-event.js. Returns an event object with:

```
{
  type: "setup",
  uid,
  user,
  log: null,
  diaryEntry: null,
  dateStr: (the day setup was completed),
  yearMonth,
  firedAt,
  key: "{uid}-setup-{yearMonth}"
}
```

### Render behavior

The setup card renders like a simplified version of a log card:

- Avatar + name + timestamp (same as log/diary cards)
- Tier badge (Sharing / Low key / Ghost, same styling as normal cards)
- Copy line (resolved from the setup copy variants)
- No activity chips
- No streak/nudge spans
- No "View Calendar" link (there's nothing to see yet, they just set up)
- No milestone treatment (setup is not an earned moment)

The card uses the same `.fw-feed-evt` base class and tier modifier classes (`.fw-feed-evt--sharing`, etc.). No new CSS needed beyond what exists.

### Ghost treatment

Ghost setup cards use `.fw-feed-evt--ghost` (reduced opacity, hairline border), ghost copy class for italic Fraunces text, and the ghost avatar treatment. Same as ghost log/diary cards.

---

## Reading Setup Events

In js/event-read.js, the existing event listener on `events/{uid}/items` already picks up all event types. The setup event docs will flow through automatically since they're in the same collection.

The feed renderer in js/following-feed.js needs to handle the new type when mapping persisted events to rendered cards. When it encounters `type: "setup"`, it should call `buildSetupEvent()` to create the event object, then `renderFeedEvent()` to build the DOM.

---

## Sort Order

Setup events sort by firedAt like all other events. On the first of a new month, setup cards will appear at the top of the feed (most recently updated first) as users complete their setup throughout the day.

---

## What This Does NOT Do

- No milestone treatment. Setup is a starting gun, not an achievement.
- No re-setup events. Mid-month activity changes via Manage Activities are silent.
- No activity names in the copy. The feed says "someone committed," not "someone committed to X."
- No new CSS classes or visual treatment. Setup cards use the existing card structure.
- No changes to the People view or All tab. Setup events only appear in the Feed view.

---

## Implementation Checklist

1. Add `recordSetupEvent()` to js/event-write.js
2. Call it from js/month-setup.js after successful setDoc, before overlay closes
3. Add setup copy variants to data/signal-copy.json (sharing, lowkey, ghost)
4. Add `{month}` variable support to fillFeedCopy() in js/feed-copy.js
5. Add `buildSetupEvent()` to js/feed-event.js
6. Add `type: "setup"` handling to renderFeedEvent() in js/feed-event.js
7. Add `type: "setup"` handling to the event mapping in js/following-feed.js

---

*Spec written May 2026. Companion to FEED_EVENT_SPEC.md, FEED_EVENTS_PERSISTENCE_SPEC.md, and MILESTONE_CARD_SPEC.md.*
