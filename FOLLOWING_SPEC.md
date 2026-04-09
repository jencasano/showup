# Following Tab -- Implementation Spec

## Overview

The Following tab has two views toggled by a pill switcher in the tab header:

- **Feed view** (default) -- chronological stream of diary entries and milestones from people you follow. Cards grouped under date separators (Today, Yesterday, April 4, etc.). A Pinned panel sits on the right on desktop; on mobile it moves to the top of the feed.
- **People view** -- organized into three sections: Pinned, Showing Up, and Crickets (see below).

No global month bar on Following. The tab always defaults to the current month. Each Pinned card has its own month nav to browse that person's history independently.

---

## Privacy Tiers

Privacy settings apply to **Calendar** and **Diary independently**. A user can be Sharing their calendar but Ghost on diary, for example. Two separate settings, one card.

**Exception: Private cascades.** If either Calendar or Diary is set to Private, the other automatically becomes Private too. Private is all-or-nothing -- it makes no sense to be invisible on one and visible on the other. Ghost does not cascade; it is a per-setting choice.

| Tier | Label | Calendar: what it shows | Diary: what it shows | Visible in All tab (non-followers) | Visible to Followers |
|------|-------|--------------------------|----------------------|-------------------------------------|----------------------|
| 1 | **Sharing** | Full 7-day strip + habit chips | Full note + photo | Yes -- full card | Yes -- full card |
| 2 | **Followers** | Full 7-day strip + habit chips | Full note + photo | Locked card (lock icon, no hints) | Yes -- full card |
| 3 | **Low key** | Signal copy only, no strip or chips | Signal copy only, no note or photo | Yes -- signal copy card | Yes -- signal copy card |
| 4 | **Ghost** | Name only, no content | Name only, no content | Yes -- name in People list, nothing in Feed | Yes -- name in People list, nothing in Feed |
| 5 | **Private** | Not shown | Not shown | Not discoverable, not shown anywhere | Not shown; follow relationship cannot be initiated |

### Who can be followed

There is no separate "allow following" toggle. The privacy tier determines followability implicitly:

- **Tiers 1-4 (Sharing, Followers, Low key, Ghost)** -- user is followable and discoverable (except Ghost, which is present but content-hidden).
- **Tier 5 (Private)** -- user is completely undiscoverable. They cannot be found in the All tab, cannot be followed, and do not appear anywhere in anyone else's UI.

### Privacy cascade rules

| Action | Result |
|--------|--------|
| User sets Calendar to Private | Diary auto-sets to Private |
| User sets Diary to Private | Calendar auto-sets to Private |
| User sets Calendar to Ghost | Diary stays unchanged |
| User sets Diary to Ghost | Calendar stays unchanged |

### The Ghost vs. Private distinction

**Ghost** = I'm here, I'm just quiet. You can follow me. You'll see my name. Nothing more. Think: social media detox. They didn't delete their account. They're just not posting.

Ghost mode means your content is invisible, but your presence isn't. People can still follow you -- you just never appear in their Feed, and your calendar and diary are completely hidden. You're in their People list as a name, nothing more. The follow relationship persists, it just goes quiet. If Lulu goes Ghost, her followers shouldn't lose the connection entirely -- she might come back someday.

**Private** = I don't exist to you. You can't find me, you can't follow me, I don't appear anywhere. Think: witness protection.

### Low key tier -- signal copy

Low key is the same for all audiences (followers and non-followers alike). Low key is about *how you want to be seen*, not *who you want to see you*. The signal copy is the curated version of you.

Signal copy is computed client-side from log data without exposing raw details:

| Condition | Copy |
|-----------|------|
| Day one ever | "Sofia just started. Day one." |
| Comeback after 30+ days | "Dan is back. Something's stirring." |
| Comeback after 7-29 days | "Dan is finding his rhythm again." |
| 25+ day streak | "Lulu has been incredibly consistent this month." |
| 15+ day streak | "Lulu has been showing up a lot lately." |
| 7+ day streak | "Lulu is building something." |
| 3+ day streak | "Lulu showed up again today." |
| 1-2 days | "Lulu just checked in." |
| Fallback | "Lulu is showing up quietly." |

---

## People View -- Sections

- **Pinned** -- Full calendar cards with per-card month nav. User-curated.
- **Showing Up** -- Compact rows for unpinned follows who have a tracker this month. Tap to expand inline.
- **Crickets** -- Compact rows for follows with no tracker this month. Shows "Last tracked: [month]".

---

## Feed View

Chronological stream of diary entries and milestones. Cards are grouped under date separators.

On desktop: Pinned panel on the right showing mini calendar cards for pinned users.
On mobile: Pinned panel moves to the top of the feed.

### System events in the Feed

When a followed user switches to Private, their existing followers receive a system event card in their Feed. These are distinct from diary/log cards -- muted styling, small, with a subtle icon. They slot into the Feed chronologically.

**When they go Private:**
> "Someone you follow went off the grid. We're holding the door open."

**When they come back (switch to any non-Private tier):**
> "Someone you were following is back."

Rules:
- No name is shown in either event card -- respects their privacy in both directions.
- The "back" event does not mention what tier they returned to. The card speaks for itself.
- The follow relationship **persists but goes dormant** while Private. The followed person does not appear in Feed or People view while Private.
- If they return to any non-Private tier, they reappear naturally -- no manual reconnecting needed.
- System events are stored per-follower (subcollection on the follower's user doc).
- System events do not expire -- they are lightweight and serve as permanent context in the relationship timeline.

---

## Data / Firestore Notes

- Privacy settings stored on the user doc: `calendarPrivacy` and `diaryPrivacy` fields, each with values: `sharing`, `followers`, `lowkey`, `ghost`, `private`.
- Private cascade is enforced at the UI settings level -- when either field is set to `private`, both are written as `private` in the same Firestore update.
- System feed events stored in a subcollection on the follower's user doc (e.g. `users/{followerUid}/feedEvents/{eventId}`).
- Private users are excluded from All tab queries entirely at the query/render level -- they are not discoverable.
- Dormant follows (where followed user is Private) are tracked but suppressed in UI rendering.
