# Feed Build Plan -- Handoff to VSCii

This document is the implementation plan for the Feed view in the Following tab.
Read FEED_SPEC.md and FOLLOWING_SPEC.md first. This doc covers what is done, what needs doing, and how to test each piece.

---

## The Test Harness

A standalone file `feed-test.html` lives in the repo root. Open it via Live Server to test feed card rendering without needing Firebase or a real session.

**How to use it:**
- Left panel: control panel (card type, tiers, has log, has diary, streak, etc.)
- Right panel: renders the real `renderFeedCard()` output
- Debug block below the card shows the exact mock data passed in
- Hit Render after changing any setting

**What it tests today:**
- Day card -- all privacy tier combos (sharing, followers, lowkey, ghost, private)
- Has log / has diary toggles
- Milestone card and System event card slots (placeholder only -- not yet built)

**Key files the harness imports:**
- `js/feed-card.js` -- the real card renderer
- `js/following-utils.js` -- getPrivacy(), renderTierBadge()
- `js/following-signals.js` -- computeSignal(), pickCopy()
- `js/diary-strip.js` -- renderDiaryStrip()

The harness passes a no-op `pinHandler` via the options param on `renderFeedCard` so the Pin button does not error outside Firebase context.

---

## Current State -- What Is Done

### Shipped and working
- Feed view renders one card per followed user
- Ghost treatment (per-zone opacity, moon emoji, ghost copy)
- Low key treatment (signal copy, LOW KEY badge)
- Sharing / Followers treatment (chips, 7-day strip, diary strip)
- Tier badges on both zones
- Pin button
- Zone divider between activity and diary zones (Phase 1a fix -- done)
- Double "diary." label removed (Phase 1a fix -- done)
- Ghost opacity scoped to zone level, not card level (done)
  - Ghost + Ghost: whole card at reduced opacity
  - Ghost + other: only the ghost zone is muted, other zone full opacity
- Per-day diary fetch: feed now fetches `diary/{uid}/entries/YYYY-MM-DD` for today specifically, not latest-ever (Phase 1b fix -- done)
  - `fetchLatestDiaryEntry` still used by People view (pinned cards) -- do not change it
  - `fetchTodayDiaryEntry` used by feed only

### Known remaining bugs (fix before adding features)
1. Empty diary zone not omitting silently in log-only state (sharing/followers branch).
   When Has log is checked and Has diary is unchecked, the diary zone label row still renders with an empty body. It should be omitted entirely when there is no diary entry and the tier is sharing or followers.
   Fix location: `js/feed-card.js`, sharing/followers branch, diary zone render block.

---

## What Needs Building -- In Order

### Phase 2 -- Feed sort by last updated (do this first, it makes the feed feel alive)

**The problem:** Feed currently sorts by max active day number (which day of the month someone last logged). Two people who both logged today tie and sort alphabetically. The spec says sort by last updated timestamp -- most recently updated card floats to top.

**What to build:**

Step 1 -- Add `lastUpdated: serverTimestamp()` to the log write in `js/tracker.js`.
Find the function that saves/updates the log entry to Firestore. Add `lastUpdated` as a serverTimestamp field to the same write. This means every log tap updates the timestamp.

Step 2 -- The diary entry already has a date in its doc ID (`2026-04-10`). We can derive a timestamp from it by parsing the doc ID.

Step 3 -- In `js/following-feed.js`, replace the `maxActiveDay` sort with a new sort that:
- Reads `logsCache[uid]?.lastUpdated` (Firestore Timestamp) for the log signal
- Reads `diaryCache[uid]?.docId` (string like "2026-04-10") and converts it to a comparable value for the diary signal
- Uses the more recent of the two as the sort key
- Users with no signal sort to the end alphabetically (same as now)

Step 4 -- Update `feed-test.html` harness: add a `lastUpdated` field to the mock log object so the debug block reflects the new field. Value can be a plain JS Date for mock purposes.

---

### Phase 3 -- Changed zone states

**The problem:** The feed spec defines four day card states based on whether a log and/or diary entry exist for that day. Currently only two states are handled correctly (log + diary, and log only with diary omitted silently -- though the silent omit bug above needs fixing first).

The two missing states are:

**State 3 -- Diary only (log was removed, diary remains):**
- Calendar zone shows a "changed" message instead of the activity zone content
- Diary zone shows full content normally
- Copy pool (randomize at render time, seeded by uid + date so same viewer sees same copy):
  - "Plans shifted. The day's still happening."
  - "Something changed. The rest remains."
  - "Logged something earlier. It's gone now."
  - "The day looked different this morning."
- These copy strings already exist in `data/signal-copy.json` as `changed_cal_1` through `changed_cal_4`
- The changed message replaces the entire cal zone content (no chips, no strip, no tier badge)
- Style it like the low key signal block -- centered italic text, muted color, no background

**State 4 -- Neither (log removed, diary removed):**
- Card is removed from feed entirely
- This should already work (no log = card not rendered). Verify it does.

**What to build:**

In `js/feed-card.js`, in the sharing/followers branch:

Before rendering the cal zone content, check: does `log` exist AND does it have activities with marks?
- If yes: render chips + strip as normal (existing behavior)
- If no AND diaryEntry exists: render the changed-cal message using `pickCopy(["changed_cal_1","changed_cal_2","changed_cal_3","changed_cal_4"], uid, dateStr)`. Style as centered italic muted text, same visual weight as ghost copy.
- If no AND no diaryEntry: do not render the card at all (return null, caller skips null cards)

Also handle the diary-removed state:
When log exists but diaryEntry is null AND we want to show that a diary entry existed and was removed -- this is tricky because we cannot know from the client if a diary entry ever existed. For v1: simply omit the diary zone silently when diaryEntry is null (the existing log-only behavior). The diary-removed copy ("Wrote something earlier. It's gone now.") is a future enhancement that requires server-side tracking of whether an entry ever existed. Skip for now, note in a comment.

In `js/following-feed.js`, update the card render loop:
- `renderFeedCard` may return null (neither state). Skip null results when appending to stream.

**Add to harness:**
In `feed-test.html`, the "Has log" and "Has diary entry" toggles already exist. After building Phase 3:
- Uncheck Has log, check Has diary entry: should show changed-cal message + full diary zone
- Uncheck both: should render nothing (or a note in the harness saying "card would be removed")

---

### Phase 4 -- Milestone cards

**What they are:** Lightweight cards that appear in the feed when a followed user hits a notable moment. Distinct from day cards -- smaller, no zones, coral left accent, celebratory.

**Milestone triggers:**
- First day ever logging
- Comeback after 7+ days absent
- Comeback after 30+ days absent
- 7-day streak
- 15-day streak
- 25-day streak

These map exactly to the signal copy keys already in `following-signals.js` (`computeSignal` returns a key). When `computeSignal` returns `first_ever`, `comeback_30`, `comeback_7`, `streak_25`, `streak_15`, or `streak_7` -- a milestone card should be generated for that user for today.

**Storage approach (Option B -- store milestone events):**
Milestone cards are stored so they appear once and persist. They do not recompute on every feed load.

Firestore path: `milestones/{uid}/events/{YYYY-MM-DD-type}` (e.g. `milestones/abc123/events/2026-04-10-streak_7`)

Doc fields:
- `type`: string (first_ever, comeback_30, comeback_7, streak_25, streak_15, streak_7)
- `uid`: string
- `displayName`: string
- `date`: string (YYYY-MM-DD)
- `createdAt`: serverTimestamp

**When to write:** In `js/tracker.js`, inside the log save function, after saving the log:
- Call `computeSignal` with the updated log data
- Check if the result key is one of the six milestone keys
- Build the doc ID: `{YYYY-MM-DD}-{key}`
- Check if that doc already exists in `milestones/{uid}/events/{docId}` -- if it does, skip (already recorded)
- If not, write it

**What to render:**
A new function `renderMilestoneCard(milestone, user)` in `js/feed-card.js` (or a new `js/milestone-card.js` if it gets complex):
- Small card, no zones
- Coral left border accent (4px solid var(--color-primary))
- Avatar + name in header (same as day card header)
- Milestone message -- use the same copy from signal-copy.json:
  - `first_ever_calendar` copy: "{firstName} just started. Day one."
  - `streak_7_calendar` copy: "{firstName} is building something." etc.
- Date shown small below the message
- No Pin button (milestones are not pinnable)

**In `js/tracker-following.js`:**
Alongside the diary fetch, add a milestone fetch per uid:
- Query `milestones/{uid}/events` -- get all docs
- Cache by uid in a `milestonesCache` keyed as `milestonesCache[uid] = [array of milestone docs]`
- Pass `milestonesCache` into the model for both feed and people views

**In `js/following-feed.js`:**
After building day cards, also iterate `milestonesCache[uid]` for each followed user and render milestone cards. Merge all cards (day + milestone) into a single array, sort by date/lastUpdated descending, then render.

**Add to harness:**
The Milestone card radio button already exists in `feed-test.html`. Replace the placeholder div with a real call to `renderMilestoneCard` using mock data based on the selected milestone type.

---

### Phase 5 -- "New activity" pill (real-time update UX)

**The problem:** The feed uses onSnapshot for logs, so it updates in real time. But if cards re-sort while you are reading, it is jarring.

**What to build:**
- When a feed update arrives (onSnapshot fires after initial load), do not re-render immediately
- Instead, set a flag and show a small pill at the top of the feed: "New activity"
- When the user taps the pill, re-render the feed with the latest data and hide the pill
- If the user does not tap, the feed stays as-is until they tap or navigate away

Implementation notes:
- Track whether the feed has already done its first render with a boolean `feedInitialized`
- On first render, set `feedInitialized = true` and render normally
- On subsequent onSnapshot fires, if `feedInitialized` is true, show the pill instead of re-rendering
- The pill is a fixed-position element at the top of the feed container, coral background, white text, tap to reload

---

## Firestore Rules Note

Current rules allow any logged-in user to read diary entries and logs. No changes needed for any of the above phases. Milestone collection will need a read rule added when Phase 4 is built:

```
match /milestones/{userId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.auth.uid == userId;
  match /events/{eventId} {
    allow read: if request.auth != null;
    allow write: if request.auth != null && request.auth.uid == userId;
  }
}
```

---

## File Map (key files for this build)

| File | Role |
|---|---|
| `js/feed-card.js` | Day card renderer. All card rendering logic lives here. |
| `js/following-feed.js` | Feed layout, sort, empty state. Calls renderFeedCard. |
| `js/tracker-following.js` | Data orchestrator. Fetches logs, users, diary, milestones. Passes to feed/people views. |
| `js/following-signals.js` | computeSignal(), pickCopy(). Signal copy logic. |
| `js/tracker.js` | Log save logic. Phase 2 adds lastUpdated field here. Phase 4 adds milestone write here. |
| `data/signal-copy.json` | All copy strings. Ghost, low key, changed, signal keys. |
| `feed-test.html` | Dev harness. Always update this when adding new card types or states. |
| `FEED_SPEC.md` | Full feed spec. Source of truth. |
| `FOLLOWING_SPEC.md` | Privacy tiers, combination matrix, follow model. |

---

*Written by Cii -- April 2026. Keep this doc updated as phases complete.*
