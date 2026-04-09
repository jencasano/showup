# All Tab -- Implementation Spec

## Overview

The All tab is a **discovery directory** -- a place to find anyone tracking this month, see their status, and follow them. It is not a feed. It is not a social timeline. It is a clean, searchable list of everyone showing up, filtered and styled by their privacy tier.

---

## Layout

- Centered container, max-width 960px, consistent with Mine and Following tabs
- Full-bleed on mobile (standard app padding)
- No tab-level header or pill switcher -- the All tab has one view only

---

## Month Navigation

The All tab does **not** use the global month bar. Instead, each card has its own per-card month nav (prev/next arrows + month label), identical in behavior to the pinned cards in the Following tab.

**Rationale:** The All tab is a discovery directory. Per-card month nav lets you browse one person's history without forcing all other cards to change month simultaneously. This makes comparison and exploration natural -- the same reason Following tab adopted per-card nav for pinned cards.

**Default month:** Each card defaults to the current month on load.

**Global month bar behavior:** The global month bar (shared with Mine tab) no longer affects the All tab. Mine tab remains the only tab controlled by the global bar.

---

## Tab Structure (top to bottom)

### 1. Stat line
A single quiet line above the search bar:

> "X people tracking this month"

- Count includes only users visible in the All tab (Sharing, Followers, Low key, Ghost -- excludes Private)
- Always reads "this month" (refers to the current calendar month, regardless of what month individual cards are browsing)
- Small font, muted color, no icon
- Updates reactively with the snapshot

### 2. Search bar
- Placeholder: "Search people or activities"
- Searches by display name and username across all visible tiers
- Low key and Locked (Followers tier) users: searchable by name only, not by activities (their activities are private)
- Ghost users: searchable by name only
- No "Include followed" toggle -- removed. All users appear in one flat list.
- No filter chips, no sort controls

### 3. Cards
Alphabetical order, A-Z by display name. No followed-first priority -- the Following tab already handles that view.

---

## Card States by Privacy Tier

### Tier 1 -- Sharing
Full calendar card.
- Full cal grid + activity dots
- Per-card month nav (prev/next + month label) in the badge row
- Activity legend footer
- Follow / Following button
- Entire card is tappable (future: navigates to profile)

### Tier 2 -- Followers
Locked card. Shown to everyone in the All tab regardless of follow status.
- Avatar + display name (same badge style as full card)
- Lock icon
- Copy: "Follow to see their tracker."
- Follow / Following button (this is the CTA)
- No calendar grid, no activity data
- No per-card month nav (nothing to browse)
- Entire card is tappable (future: navigates to profile)

### Tier 3 -- Low key
Signal copy card. Same copy for all audiences -- Low key is about how they want to be seen, not who sees them.
- Avatar + display name
- Signal copy text (calendar variant), computed from log data via `following-signals.js`
- No calendar grid, no activity chips, no raw data
- Per-card month nav (signal copy updates per month)
- Follow / Following button
- Entire card is tappable (future: navigates to profile)

### Tier 4 -- Ghost
Name-only pill. Minimal presence.
- Avatar + display name
- Copy: "Gone quiet for now."
- No follow button on the card (Ghost users are followable, but the All tab card is not the right place for that CTA -- future profile page handles it)
- No per-card month nav (nothing to browse)
- Subtle gold glow treatment to signal Ghost status
- Entire card is tappable (future: navigates to profile)

### Tier 5 -- Private
Not shown. Excluded entirely from queries and rendering.

---

## Card Tap Behavior

All cards are tappable containers. The follow button and month nav arrows use `e.stopPropagation()` so they do not trigger the card tap.

Current behavior: card tap is a no-op placeholder. Do not show a toast or any feedback. Just wire the tap handler and leave it empty -- profile navigation activates it when user profiles are built.

---

## Ordering

- Primary: alphabetical A-Z by display name
- No tier-based grouping (Sharing cards do not float above Locked cards, etc.)
- Ghost pills sit in alphabetical position alongside full cards -- no separate section

---

## Per-Card Month Nav -- Implementation Notes

Each Sharing and Low key card manages its own `cardYearMonth` state, independent of every other card. Pattern is identical to `renderPinnedCard` in `following-people.js`:

- Prev/next buttons update `cardYearMonth` and fetch the new log doc from Firestore
- Month label updates to reflect the browsed month (e.g. "Mar", "Apr")
- If the fetched month has no log, render an empty state within the card (not a full card removal)
- Nav arrows live in the card badge row, right-aligned, same as Following pinned cards

---

## Data / Firestore Notes

- Privacy tier is read from `userData.calendarPrivacy` (already fetched via user doc in `tracker-all.js`)
- Tier values: `sharing`, `followers`, `lowkey`, `ghost`, `private`
- Private users are excluded before rendering -- not fetched into the entries array
- Low key signal copy is computed client-side from log data using `following-signals.js` (same logic as Following tab)
- The "Include followed" toggle and its `includeFollowed` state variable are removed entirely from `tracker-all.js`
- Per-card month nav fetches individual log docs on demand: `logs/{yearMonth}/entries/{uid}`

---

## Files to Create or Modify

| File | Action | Notes |
|---|---|---|
| `js/tracker-all.js` | Modify | Tier branching; per-card month nav wiring; stat line |
| `js/tracker-all-cards.js` | Create (new) | `renderLockedCard`, `renderLowKeyCard`, `renderGhostCard` -- new card types for non-Sharing tiers |
| `js/cal-card.js` | Modify | Add per-card month nav to `renderMobileCard` (Sharing cards) |
| `css/tracker.css` | Modify | Styles for `.all-locked-card`, `.all-lowkey-card`, `.all-ghost-pill` |

The new card types live in `tracker-all-cards.js` to keep `tracker-all.js` lean. `cal-card.js` handles the full Sharing card (already exists, just needs month nav added).

---

## Relationship to User Profiles

User profiles are the next major feature after the All tab. When profiles land:
- Card taps will navigate to `/profile/{userId}` or open a profile overlay
- The Locked card CTA may evolve from "Follow to see their tracker" to "View profile" -- the follow action moves inside the profile
- Ghost cards will link to profiles that show presence (bio, join date) without revealing content

No changes needed in the All tab to support this -- just activating the existing tap handler.

---

*Spec written by Cii -- April 2026*
