# All Tab -- Implementation Spec

## Overview

The All tab is a **discovery directory** -- a place to find anyone tracking this month, see their status, and follow them. It is not a feed. It is not a social timeline. It is a clean, searchable list of everyone showing up this month, filtered and styled by their privacy tier.

---

## Layout

- Centered container, max-width 960px, consistent with Mine and Following tabs
- Full-bleed on mobile (standard app padding)
- No tab-level header or pill switcher -- the All tab has one view only

---

## Tab Structure (top to bottom)

### 1. Stat line
A single quiet line above the search bar:

> "X people tracking this month"

- Count includes only users visible in the All tab (Sharing, Followers, Low key, Ghost -- excludes Private)
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
Full calendar card. Same as current behavior.
- Full cal grid + activity dots
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
- Entire card is tappable (future: navigates to profile)

### Tier 3 -- Low key
Signal copy card. Same copy for all audiences -- Low key is about how they want to be seen, not who sees them.
- Avatar + display name
- Signal copy text (calendar variant), computed from log data via `following-signals.js`
- No calendar grid, no activity chips, no raw data
- Follow / Following button
- Entire card is tappable (future: navigates to profile)

### Tier 4 -- Ghost
Name-only pill. Minimal presence.
- Avatar + display name
- Copy: "Gone quiet for now."
- No follow button on the card (Ghost users are followable, but the All tab card is not the right place for that CTA -- future profile page handles it)
- Subtle gold glow treatment to signal Ghost status
- Entire card is tappable (future: navigates to profile)

### Tier 5 -- Private
Not shown. Excluded entirely from queries and rendering.

---

## Card Tap Behavior

All cards are tappable containers. The follow button uses `e.stopPropagation()` so it does not trigger the card tap.

Current behavior: card tap is a no-op placeholder. Do not show a toast or any feedback. Just wire the tap handler and leave it empty -- profile navigation activates it when user profiles are built.

---

## Ordering

- Primary: alphabetical A-Z by display name
- No tier-based grouping (Sharing cards do not float above Locked cards, etc.)
- Ghost pills sit in alphabetical position alongside full cards -- no separate section

---

## Data / Firestore Notes

- Privacy tier is read from `userData.calendarPrivacy` (already fetched via user doc in `tracker-all.js`)
- Tier values: `sharing`, `followers`, `lowkey`, `ghost`, `private`
- Private users are excluded before rendering -- not fetched into the entries array
- Low key signal copy is computed client-side from log data using `following-signals.js` (same logic as Following tab)
- The "Include followed" toggle and its `includeFollowed` state variable are removed entirely from `tracker-all.js`

---

## Files to Create or Modify

| File | Action | Notes |
|---|---|---|
| `js/tracker-all.js` | Modify | Remove `includeFollowed` toggle; add tier branching; update ordering; add stat line |
| `js/tracker-all-cards.js` | Create (new) | `renderLockedCard`, `renderLowKeyCard`, `renderGhostCard` |
| `css/tracker.css` or `css/all-cards.css` | Modify or create | Styles for `.all-locked-card`, `.all-lowkey-card`, `.all-ghost-pill` |

Modularizing the new card types into `tracker-all-cards.js` keeps `tracker-all.js` lean and follows the project's aggressive modularization principle.

---

## Relationship to User Profiles

User profiles are the next major feature after the All tab. When profiles land:
- Card taps will navigate to `/profile/{userId}` or open a profile overlay
- The Locked card CTA may evolve from "Follow to see their tracker" to "View profile" -- the follow action moves inside the profile
- Ghost cards will link to profiles that show presence (bio, join date) without revealing content

No changes needed in the All tab to support this -- just activating the existing tap handler.

---

*Spec written by Cii -- April 2026*
