# Following Tab -- Implementation Spec

## Overview

The Following tab has two views toggled by a pill switcher in the tab header:

- **Feed view** (default) -- chronological stream of diary entries and milestones from people you follow. Cards grouped under date separators (Today, Yesterday, April 4, etc.). A Pinned panel sits on the right on desktop; on mobile it moves to the top of the feed.
- **People view** -- organized into three sections: Pinned, Showing Up, and Crickets (see below).

No global month bar on Following. The tab always defaults to the current month. Each Pinned card has its own month nav to browse that person's history independently.

---

## Follow Model

showup. uses **one-way following**, like Twitter/X. You follow someone; they do not need to follow you back. There is no "mutual follow" requirement anywhere in the app.

- If you follow Lulu, she appears in your Following tab.
- Lulu does not need to follow you back for you to see her content.
- The Followers privacy tier means "visible to anyone who follows me" -- not "visible to mutual followers".
- Following someone is always a unilateral action. Unfollowing is also unilateral and silent.

---

## Privacy Tiers

Privacy settings apply to **Calendar** and **Diary independently**. A user can be Sharing their calendar but Ghost on diary, for example. Two separate settings, one card.

**Exception: Private cascades.** If either Calendar or Diary is set to Private, the other automatically becomes Private too. Private is all-or-nothing -- it makes no sense to be invisible on one and visible on the other. Ghost does not cascade; it is a per-setting choice.

| Tier | Label | Calendar zone | Diary zone |
|------|-------|---------------|------------|
| 1 | **Sharing** | Full 7-day strip + habit chips | Full note + photo |
| 2 | **Followers** | Full 7-day strip + habit chips (followers only; strangers see locked) | Full note + photo (followers only; strangers see locked) |
| 3 | **Low key** | Signal copy only -- data-flavored, no strip or chips | Signal copy only -- feeling-flavored, no note or photo |
| 4 | **Ghost** | "Gone quiet for now." moon treatment, no data | "Gone quiet for now." moon treatment, no content |
| 5 | **Private** | Not shown | Not shown |

### Who can be followed

There is no separate "allow following" toggle. The privacy tier determines followability implicitly:

- **Tiers 1-4 (Sharing, Followers, Low key, Ghost)** -- user is followable and discoverable.
- **Tier 5 (Private)** -- user is completely undiscoverable. They cannot be found in the All tab, cannot be followed, and do not appear anywhere in anyone else's UI.

### Privacy cascade rules

| Action | Result |
|--------|--------|
| User sets Calendar to Private | Diary auto-sets to Private |
| User sets Diary to Private | Calendar auto-sets to Private |
| User sets Calendar to Ghost | Diary stays unchanged |
| User sets Diary to Ghost | Calendar stays unchanged |

### The Ghost vs. Private distinction

**Ghost** = I'm here, I'm just quiet. You can follow me. You'll see my name and "Gone quiet for now." on both zones. Think: social media detox. The follow relationship persists, it just goes quiet. If Lulu goes Ghost, her followers shouldn't lose the connection entirely -- she might come back someday.

Ghost applies per-zone. If only the diary is Ghost, the calendar renders normally and the diary zone shows "Gone quiet for now." If both are Ghost, both zones show that treatment.

**Private** = I don't exist to you. You can't find me, you can't follow me, I don't appear anywhere. Think: witness protection.

### Low key tier -- signal copy

Low key is the same for all audiences (followers and non-followers alike). Low key is about *how you want to be seen*, not *who you want to see you*. The signal copy is the curated version of you.

Signal copy is computed client-side from log data without exposing raw details. Each condition has two variants -- one for the calendar zone (data-flavored) and one for the diary zone (feeling-flavored):

| Condition | Calendar copy | Diary copy |
|-----------|--------------|------------|
| Day one ever | "{firstName} just started. Day one." | "Something's beginning for {firstName}." |
| Comeback after 30+ days | "{firstName} is back. Something's stirring." | "{firstName} went quiet for a while. Now they're back." |
| Comeback after 7-29 days | "{firstName} is finding their rhythm again." | "Feels like {firstName} is working something out." |
| 25+ day streak | "{firstName} has been incredibly consistent this month." | "There's a lot going on in {firstName}'s world right now." |
| 15+ day streak | "{firstName} has been showing up a lot lately." | "{firstName} has been in their head lately. In a good way." |
| 7+ day streak | "{firstName} is building something." | "Something's taking shape for {firstName}." |
| 3+ day streak | "{firstName} showed up again today." | "{firstName} has been showing up." |
| 1-2 days | "{firstName} just checked in." | "{firstName} stopped by." |
| Fallback | "{firstName} is showing up quietly." | "{firstName} is keeping this one close." |

Templates live in `data/signal-copy.json` with keys like `streak_7_calendar` and `streak_7_diary`. Logic stays in `js/following-signals.js`.

---

## All Privacy Combinations -- Display Reference

**Key:**
- **Full cal** = 7-day strip + habit chips
- **Full diary** = note + photo
- **Signal cal** = calendar-flavored signal copy
- **Signal diary** = diary-flavored signal copy
- **Ghost cal** = "Gone quiet for now." moon treatment on calendar zone
- **Ghost diary** = "Gone quiet for now." moon treatment on diary zone
- **Locked** = lock icon, no content, no hints (Followers tier, stranger only)
- **Hidden** = not shown anywhere

**Three rules that hold across every combination:**
1. A follower always sees the same card in the Following tab and the All tab. Following-tab and All-tab-follower columns are identical every time.
2. Low key and Ghost are audience-agnostic -- signal copy and ghost treatment show the same to followers and strangers.
3. Only the Followers tier discriminates by audience -- strangers get Locked, followers get Full.

### Calendar = Sharing

| Diary tier | Following tab (follower) | All tab - follower | All tab - stranger |
|---|---|---|---|
| Sharing | Full cal + Full diary | Full cal + Full diary | Full cal + Full diary |
| Followers | Full cal + Full diary | Full cal + Full diary | Full cal + Locked diary |
| Low key | Full cal + Signal diary | Full cal + Signal diary | Full cal + Signal diary |
| Ghost | Full cal + Ghost diary | Full cal + Ghost diary | Full cal + Ghost diary |
| Private | Hidden | Hidden | Hidden |

### Calendar = Followers

| Diary tier | Following tab (follower) | All tab - follower | All tab - stranger |
|---|---|---|---|
| Sharing | Full cal + Full diary | Full cal + Full diary | Locked cal + Full diary |
| Followers | Full cal + Full diary | Full cal + Full diary | Locked cal + Locked diary |
| Low key | Full cal + Signal diary | Full cal + Signal diary | Locked cal + Signal diary |
| Ghost | Full cal + Ghost diary | Full cal + Ghost diary | Locked cal + Ghost diary |
| Private | Hidden | Hidden | Hidden |

### Calendar = Low key

| Diary tier | Following tab (follower) | All tab - follower | All tab - stranger |
|---|---|---|---|
| Sharing | Signal cal + Full diary | Signal cal + Full diary | Signal cal + Full diary |
| Followers | Signal cal + Full diary | Signal cal + Full diary | Signal cal + Locked diary |
| Low key | Signal cal + Signal diary | Signal cal + Signal diary | Signal cal + Signal diary |
| Ghost | Signal cal + Ghost diary | Signal cal + Ghost diary | Signal cal + Ghost diary |
| Private | Hidden | Hidden | Hidden |

### Calendar = Ghost

| Diary tier | Following tab (follower) | All tab - follower | All tab - stranger |
|---|---|---|---|
| Sharing | Ghost cal + Full diary | Ghost cal + Full diary | Ghost cal + Full diary |
| Followers | Ghost cal + Full diary | Ghost cal + Full diary | Ghost cal + Locked diary |
| Low key | Ghost cal + Signal diary | Ghost cal + Signal diary | Ghost cal + Signal diary |
| Ghost | Ghost cal + Ghost diary | Ghost cal + Ghost diary | Ghost cal + Ghost diary |
| Private | Hidden | Hidden | Hidden |

### Calendar = Private

All diary tier combinations are Hidden everywhere for everyone.

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
- Follow relationships are stored as a `following` array on the follower's user doc. One-way -- no mirroring required.
- System feed events stored in a subcollection on the follower's user doc (e.g. `users/{followerUid}/feedEvents/{eventId}`).
- Private users are excluded from All tab queries entirely at the query/render level -- they are not discoverable.
- Dormant follows (where followed user is Private) are tracked but suppressed in UI rendering.
- **All tab rendering must check the viewer's following list.** If the viewer follows a person, that person's card in the All tab renders at follower-level access -- identical to what the viewer sees in the Following tab. Only non-followers get stranger-level access (Followers tier locked, etc.).
