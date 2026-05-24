# Profile View -- Implementation Spec

## Overview

The profile view is a wide side drawer that slides in from the right when a user taps on someone's card (in Following, Feed, or All tabs) or taps their own avatar. It overlays the current view with a dimmed backdrop and presents two columns: identity on the left, substance on the right.

Two audiences: **own profile** (the logged-in user viewing their own) and **visitor profile** (viewing someone else). Privacy tiers from FOLLOWING_SPEC.md apply to both the activity zone and diary zone independently.

---

## Layout: Wide Side Drawer

### Desktop

- Drawer slides in from the right edge of the viewport.
- Width: `min(780px, calc(100vw - 260px))` so the sidebar stays visible behind the overlay.
- Height: full viewport (`top: 0; bottom: 0`). No gap at the top.
- Background: `var(--paper)`. Border-left: `1px solid var(--hairline)`. Box-shadow on the left edge.
- Overlay behind the drawer: `var(--overlay-bg)`. Click overlay to close.
- Body scroll locked while drawer is open.

### Mobile

- Drawer fills the entire screen (`width: 100%; top: 0`). No border-left.
- Two columns collapse to a single column: left column content stacks on top, right column content below.
- Left column loses `position: sticky` and gets a bottom border instead of the right border.
- Back button at the top.

### Interior: Two Columns

```
+----------------------------------+
| <- back                          |
+----------+-----------------------+
|          |                       |
|  LEFT    |  RIGHT                |
|  230px   |  fills remaining      |
|  sticky  |  scrolls              |
|          |                       |
|  avatar  |  ACTIVITY [tier]      |
|  name    |  activity cards       |
|  bio     |                       |
|  since   |  THIS MONTH           |
|  social  |  stats row            |
|  follow  |                       |
|  ------  |  RECENT ACTIVITY      |
|  DIARY   |  event timeline       |
|  [zone]  |                       |
|          |                       |
+----------+-----------------------+
```

- Left column: `230px`, `position: sticky; top: 52px; align-self: start`. Border-right: `1px solid var(--hairline)`.
- Right column: fills remaining width, scrolls independently. Padding: `24px`.
- Divider between the columns is the left column's right border, not a separate element.

---

## Entry Points

The profile drawer opens from:

1. **All tab card tap** -- any card type (Sharing, Locked, Low key, Ghost). Resolves backlog item 6 (All tab card tap, currently no-op).
2. **Feed card header/avatar tap** -- tapping the avatar or name in a feed event card.
3. **People view card tap** -- tapping a Pinned card, Showing Up row, or Crickets row.
4. **Own avatar** -- tapping the avatar in the sidebar user chip (desktop) or the header avatar button (mobile).

All entry points call the same `openProfile(uid)` function. The drawer fetches data for the target uid and renders.

---

## Header (Left Column, Top)

### Avatar

- 72px circle, 3px `var(--paper-deep)` border, card shadow.
- **Own profile:** camera button overlay (absolute positioned, bottom-right). Tap to upload a new avatar photo.
  - Upload to Firebase Storage at `avatars/{uid}`.
  - Store URL as `avatarUrl` on the user doc.
  - Fallback: initial letter circle in `var(--red)` if no avatar uploaded.
- **Visitor:** no upload button. Shows avatar or initial.

### Display Name

- `Fraunces` serif, 1.2rem, weight 500. Centered.
- **Own profile:** tap to edit. Renders as an input with dashed bottom border. Saves on blur. Max 24 characters.
- **Visitor:** static text.

### Bio

- 0.78rem `Manrope`, `var(--ink-soft)`. Centered. Max width 180px. Max 100 characters.
- **Own profile:** ghost placeholder "say something about yourself..." in italic `var(--ink-faint)`. Tap to type. Saves on blur.
- **Visitor:** shows bio text. If user has no bio, the line is hidden entirely (no placeholder for visitors).
- New field on user doc: `bio` (string, optional).

### Since Date

- `DM Mono`, 0.58rem, `var(--ink-faint)`. Format: "showing up since April 2026".
- Derived from the user doc's `createdAt` timestamp or the earliest log entry if `createdAt` is missing.

### Social Counts

- Two numbers side by side: following count and follower count.
- Numbers in `Fraunces` serif, 1rem, weight 600. Labels in 0.58rem `var(--ink-faint)`.
- Following count: length of the user's `following` array.
- Follower count: `followerCount` field on user doc. Maintained by a Cloud Function (see below).

### Follow Button

- **Own profile:** not shown.
- **Visitor, not following:** red CTA pill "&#43; Follow". Fires arrayUnion on the viewer's `following` array.
- **Visitor, already following:** outline pill "&#10003; Following". Hover state: border and text turn red (hint at unfollow). Tap to unfollow with confirmation.

### Tier Badges (Own Profile Only)

- Two small tier badges: "cal: sharing" and "diary: low key" (or whatever the current tiers are).
- Uses the existing `.pb` badge classes from the feed/following system.
- **Visitor:** not shown. Visitors infer the tier from the content they see.

---

## Diary Zone (Left Column, Below Divider)

Section label: `DIARY` with tier badge.

### Sharing / Followers (follower sees)

**Diary strip** with tap-to-read inline expansion. Same `renderDiaryStrip()` pattern from `js/diary-strip.js`.

- Strip shows days 1 through today. Filled days are highlighted (amber wash + border).
- Tap a filled day to expand an inline read card below the strip: date in `DM Mono`, note in `Caveat`, polaroid photo if available. Close button at bottom.
- Tap another day to switch. Tap same day to collapse.

**Auto-expand latest entry on load.** When the drawer opens, the most recent filled diary day auto-expands so the visitor immediately sees content. No interaction required to get a taste of who this person is.

Implementation: after the diary strip renders, find the last element with the `.f` (filled) class and programmatically trigger the expand. Skip on own profile (own profile shows the notebook widget instead).

### Own Profile

**Notebook widget** (the closed-book `renderDiaryNotebook` from `js/tracker-diary.js`). Tap to open the diary modal/sheet. Shows entry count and "read it ->" hint.

### Followers (stranger sees)

Locked card: lock icon + "Follow to read their diary." Same treatment as FOLLOWING_SPEC locked cards.

### Low key

Profile-specific signal copy. Warmer and more contextual than the People view card copy, tuned for a surface where someone is spending time.

New copy keys in `signal-copy.json` under `profile_lowkey_diary_*`:

| Key | Copy |
|-----|------|
| `profile_lowkey_diary_1` | "{firstName} has been writing. Something's taking shape." |
| `profile_lowkey_diary_2` | "There are thoughts here. Warm ones." |
| `profile_lowkey_diary_3` | "The diary's been active. Whatever it holds, it matters." |
| `profile_lowkey_diary_4` | "{firstName} has been putting things into words lately." |

Uses `{firstName}` per Low key design principle (subject is the star). Selected via `pickCopy()` seeded by `uid + "profile-diary"`.

### Ghost

Profile-specific ghost copy. Warmer than the feed/card-level ghost copy; acknowledges the visitor is looking at someone's space.

New copy keys in `signal-copy.json` under `profile_ghost_diary_*`:

| Key | Copy |
|-----|------|
| `profile_ghost_diary_1` | "There's a diary here. The pages face inward." |
| `profile_ghost_diary_2` | "Pages filled, cover closed." |
| `profile_ghost_diary_3` | "The diary is real. The contents stay private." |
| `profile_ghost_diary_4` | "Lulu writes. You won't find it here." |

No `{firstName}` per Ghost design principle (about the absence, not the person). Note: variant 4 is an exception that uses the name for warmth in the profile context. Design decision: keep it, the profile is personal enough to allow it. Selected via `pickCopy()` seeded by `uid + "profile-diary"`.

Moon icon (crescent emoji) above the copy. Dashed border, reduced opacity.

### Private

No profile at all. If someone navigates to a Private user's profile (e.g. via a stale URL or direct uid), show: "This person isn't on showup." with no further content. No avatar, no name, no zones.

---

## Activity Zone (Right Column)

Section label: `ACTIVITY` with tier badge.

### Sharing / Followers (follower sees)

**Activity summary cards** -- one card per activity. NOT the raw calendar grid (the cal-card is a functional tool for logging; on a profile it's read-only and feels like staring at someone's spreadsheet).

Each card shows:
- Color dot (activity color from `getActivityColor`)
- Activity name (0.82rem, weight 600)
- Meta line: "{days}/{target} days this month -- {streak} streak" in `DM Mono` 0.66rem `var(--ink-faint)`
- Progress bar: 3px height, activity color fill, width = `(days/target) * 100%`
- Stat: percentage of target in `Fraunces` 1.1rem on the right side

Data source: the user's log doc at `logs/{yearMonth}/entries/{uid}`. Activity list from `activities` array, marks from `marks` object, cadence from each activity's `cadence` field. Streak computed from `marks` using existing streak logic from `js/stats.js`.

Cards stack vertically with 6px gap.

### Followers (stranger sees)

Locked card: lock icon + "Follow to see their tracker."

### Low key

Profile-specific signal copy for calendar:

| Key | Copy |
|-----|------|
| `profile_lowkey_cal_1` | "{firstName} has been at it. Consistently, quietly." |
| `profile_lowkey_cal_2` | "Something's building here. You can feel the rhythm." |
| `profile_lowkey_cal_3` | "{firstName} keeps showing up. That's the whole story." |
| `profile_lowkey_cal_4` | "There's a pattern forming. Steady and deliberate." |

### Ghost

Profile-specific ghost copy for calendar:

| Key | Copy |
|-----|------|
| `profile_ghost_cal_1` | "Something's being tracked here. The numbers stay private." |
| `profile_ghost_cal_2` | "There's a rhythm going. You just can't see the pattern." |
| `profile_ghost_cal_3` | "The tracker is real. The details face inward." |
| `profile_ghost_cal_4` | "Days are being counted. Not for us to see." |

---

## Stats Row (Right Column)

Only shown for Sharing and Followers(follower) calendar tiers -- same conditions as activity cards.

Three stat boxes in a 3-column grid:
- **Show-up days:** count of days with at least one mark
- **Streak:** current consecutive days streak, formatted as "4w" / "12d" / etc.
- **Perfect days:** count of days where every activity hit its cadence target

Numbers in `Fraunces` 1.1rem weight 600. Labels in 0.58rem `var(--ink-faint)`.
Background: `var(--paper-deep)`, rounded corners.

Data from the same log doc. Computation reuses existing logic from `js/stats.js`.

---

## Event Timeline (Right Column)

Section label: `RECENT ACTIVITY`.

Queries `events/{uid}/items` with a 30-day window (same `WINDOW_DAYS` used in `js/event-read.js`). Renders the most recent events in reverse chronological order.

### Sharing / Followers (follower sees at least one zone)

Full event cards. Each event renders:
- Type dot: red for activity, yellow for diary, blue for setup
- Type label: "activity" / "diary" / "setup"
- Timestamp: relative ("2h ago", "Yesterday", "3 days ago") in `DM Mono`
- Copy: the event's stored copy, rendered with the same `fillFeedCopy()` / styled spans (em for activity names, .streak for streak commentary, .nudge for nudge copy)
- Activity chips: colored pills for each activity in the burst (activity events only)
- Milestone treatment: warm wash background + gold badge for milestone contexts (same treatment as `js/feed-event.js`)

Paginated: show ~8 events initially, "view earlier ->" link at the bottom to load more.

### Low key (either zone is Low key, neither zone grants full access)

Simplified event cards with yellow left border (same `.lowkey-evt` treatment as feed). Copy uses the existing `feed_lowkey_*` copy from `signal-copy.json`. No activity chips, no milestone badges. Timestamps shown.

### Ghost (both zones are Ghost, or one Ghost + other not granting full access)

Ghost event cards with dashed border, reduced opacity. Copy uses existing `feed_ghost_*` copy. No chips, no milestones. Timestamps shown.

### Stranger on Followers tier

No events shown. The events section is not rendered at all.

### Visibility logic

Events are shown if the viewer has full access to at least one zone (calendar or diary). The logic:

```
canSeeEvents = (calTier === 'sharing') ||
               (calTier === 'followers' && isFollower) ||
               (diaryTier === 'sharing') ||
               (diaryTier === 'followers' && isFollower)
```

If `canSeeEvents` is false but either tier is Low key, show Low key events.
If both are Ghost (or one Ghost + the other not granting access), show Ghost events.
If stranger on Followers tier, show nothing.

---

## Footer (Left Column, Bottom)

### Own Profile

"your privacy settings ->" link. Tapping calls the existing `openPrivacySettingsModal()`.

### Visitor

No footer content.

---

## Close / Navigation

- **Back button:** sticky at the top of the drawer. Left arrow + "back" text. Closes the drawer.
- **Overlay click:** clicking the dimmed area behind the drawer closes it.
- **Escape key:** closes the drawer.
- **Browser back:** if possible, use `history.pushState` on open and `popstate` listener to close, so the browser back button works naturally.

Close animation: drawer slides right (reverse of open). Overlay fades out. Body scroll unlocked.

---

## New Data Fields

| Field | Location | Type | Notes |
|-------|----------|------|-------|
| `bio` | `users/{uid}` | string, optional | Max 100 chars. Empty string = no bio. |
| `avatarUrl` | `users/{uid}` | string, optional | Firebase Storage URL. Path: `avatars/{uid}`. |
| `followerCount` | `users/{uid}` | number, default 0 | Maintained by Cloud Function, not client writes. |

### Follower Count Cloud Function

A Cloud Function triggered by `onDocumentUpdated` on `users/{uid}`. Diffs the `before.following` vs `after.following` arrays. For each uid added, increment that target user's `followerCount` by 1. For each uid removed, decrement by 1. Uses `FieldValue.increment()` for atomic updates.

Rationale: avoids the client needing write access to another user's doc, prevents race conditions, keeps the Firestore rule "only you write your own doc" intact. Negligible cost on Blaze plan (2M free invocations/month).

### Avatar Upload

- Firebase Storage path: `avatars/{uid}` (single file per user, overwritten on re-upload).
- Storage rules: owner-only write, public read.
- On successful upload, write the download URL to `users/{uid}.avatarUrl`.
- Display: wherever the user's avatar is shown (profile header, feed cards, People view, All tab), read from `avatarUrl` with fallback to the initial-letter circle.

---

## New Files

| File | Purpose |
|------|---------|
| `js/profile.js` | Profile drawer module. Opens/closes drawer, fetches data, renders both columns. |
| `css/profile.css` | Profile drawer styles. |

### Shared Module Usage

The profile reuses existing modules:

- `js/following-utils.js` -- `getPrivacy()`, `renderTierBadge()`, `TIER_META`
- `js/following-signals.js` -- `computeSignal()`, `pickCopy()` for Low key/Ghost copy selection
- `js/diary-strip.js` -- `renderDiaryStrip()` for the diary strip in the left column
- `js/event-read.js` -- `subscribeToUserEvents()` or a one-shot query variant for the event timeline
- `js/stats.js` -- streak, show-up days, perfect days computation
- `js/diary.js` -- `getDiaryEntry()` for tap-to-read inline expansion
- `js/diary-covers.js` -- notebook cover rendering for own profile

---

## New Signal Copy

Add to `data/signal-copy.json`:

```json
"_divider_profile": "--- PROFILE-SPECIFIC COPY ---",

"profile_ghost_cal_1": "Something's being tracked here. The numbers stay private.",
"profile_ghost_cal_2": "There's a rhythm going. You just can't see the pattern.",
"profile_ghost_cal_3": "The tracker is real. The details face inward.",
"profile_ghost_cal_4": "Days are being counted. Not for us to see.",

"profile_ghost_diary_1": "There's a diary here. The pages face inward.",
"profile_ghost_diary_2": "Pages filled, cover closed.",
"profile_ghost_diary_3": "The diary is real. The contents stay private.",
"profile_ghost_diary_4": "Lulu writes. You won't find it here.",

"profile_lowkey_cal_1": "{firstName} has been at it. Consistently, quietly.",
"profile_lowkey_cal_2": "Something's building here. You can feel the rhythm.",
"profile_lowkey_cal_3": "{firstName} keeps showing up. That's the whole story.",
"profile_lowkey_cal_4": "There's a pattern forming. Steady and deliberate.",

"profile_lowkey_diary_1": "{firstName} has been writing. Something's taking shape.",
"profile_lowkey_diary_2": "There are thoughts here. Warm ones.",
"profile_lowkey_diary_3": "The diary's been active. Whatever it holds, it matters.",
"profile_lowkey_diary_4": "{firstName} has been putting things into words lately."
```

---

## Privacy Tier Matrix for Profile

Each zone renders independently per FOLLOWING_SPEC rules.

| Tier | Calendar Zone (right col) | Diary Zone (left col) | Stats | Events |
|------|---------------------------|----------------------|-------|--------|
| Sharing | Activity summary cards | Diary strip + auto-expand | Yes | Full timeline |
| Followers (follower) | Activity summary cards | Diary strip + auto-expand | Yes | Full timeline |
| Followers (stranger) | Locked card | Locked card | No | No |
| Low key | Profile signal copy | Profile signal copy | No | Low key events |
| Ghost | Profile ghost copy | Profile ghost copy | No | Ghost events |
| Private | No profile rendered | No profile rendered | N/A | N/A |

Mixed combos render each zone independently. Example: Cal:Sharing + Diary:Ghost = activity cards on right + ghost moon on left. Events shown because cal is Sharing (full access to at least one zone).

---

## Design Decisions

1. **No raw calendar grid on profiles.** The cal-card is a logging tool. On a profile it's read-only and feels like staring at someone else's spreadsheet. Activity summary cards give the vibe without the day-level granularity.

2. **Diary auto-expands latest entry.** A visitor shouldn't have to guess which numbered square to tap. The most recent diary entry opens on load so they immediately get a taste of who this person is.

3. **Profile-specific copy for Ghost and Low key.** The existing card-level copy works on transient surfaces (feed cards, People view). The profile is a destination where someone is spending time -- the copy should be warmer and acknowledge the visitor's presence.

4. **Avatar is inline, not a settings page.** Tap the camera button on your own avatar to upload. No "Edit Profile" button, no settings-page feel. Bio is the same -- tap to type, saves on blur. Everything is discoverable and inline.

5. **Display name uses neutral app typography, not monthly decoration.** The name in the profile header is `Fraunces` at the app level. Monthly decoration (badge color, marker shape) stays on the tracker card only, where it belongs.

6. **Follower count via Cloud Function.** Client increments would require write access to another user's doc and invite race conditions. The Cloud Function approach keeps the security model clean.

7. **Drawer, not a page.** The drawer preserves the context of where you were (Following view, All tab, Feed). You can close it and be right back where you were. A full page navigation would lose that context.

---

## Backlog Updates

After this ships:

- Backlog item 6 (All tab card tap) is resolved. Cards now open the profile drawer.
- Backlog item 13 (All tab card tap, currently no-op) is the same item, also resolved.
- New backlog item: "Following/Followers list view" -- tapping the following/followers counts on the profile could open a list. Deferred.
- New backlog item: "Profile URL / deep linking" -- profiles are currently drawer-only with no permalink. Consider `showup.jeni.rocks/u/{uid}` later.
