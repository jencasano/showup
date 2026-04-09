# All Tab -- Implementation Spec

## Overview

The All tab is a **discovery directory** -- a place to find anyone tracking this month, see their status, and follow them. It is not a feed. It is not a social timeline. It is a clean, searchable list of everyone showing up, filtered and styled by their privacy tier.

---

## Layout

- Centered container, max-width 960px, consistent with Mine and Following tabs
- Full-bleed on mobile (standard app padding)
- No tab-level header or pill switcher -- the All tab has one view only

---

## Relationship to the Following Tab

The All tab uses **the same display rules as the Following tab**, with one difference:

| Tier | Following tab | All tab |
|---|---|---|
| Sharing | Full card (calendar + diary) | Full card (calendar + diary) |
| Followers | Full card (you follow them, so you qualify) | Locked card (random browser doesn't qualify) |
| Low key | Signal copy card | Signal copy card |
| Ghost | Name only | Name only |
| Private | Not shown | Not shown |

The signal copy logic, ghost card design, diary strip, and private exclusion are all identical between tabs. Only the Followers tier diverges.

---

## Month Navigation

The All tab does **not** use the global month bar. Instead, each Sharing card has its own per-card month nav (prev/next arrows + month label), identical in behavior to the pinned cards in the Following tab.

**Rationale:** The All tab is a discovery directory. Per-card month nav lets you browse one person's history without forcing all other cards to change month simultaneously.

**Default month:** Each card defaults to the current month on load.

**Global month bar behavior:** The global month bar (shared with Mine tab) no longer affects the All tab.

**Low key, Locked, Ghost cards:** No month nav. Low key users chose to present a curated signal -- browsing their month-by-month history would expose more than they intended. Locked and Ghost have nothing to browse.

---

## Tab Structure (top to bottom)

### 1. Stat line
> "X people tracking this month"

- Count includes Sharing, Followers, Low key, Ghost -- excludes Private
- Always refers to current calendar month
- Small font, muted color, no icon

### 2. Search bar
- Placeholder: "Search people or activities"
- Sharing users: searchable by name and activities
- All other tiers: searchable by name only
- No toggle, no filter chips, no sort controls

### 3. Cards
Alphabetical A-Z by display name. No tier-based grouping.

---

## Card States by Privacy Tier

### Tier 1 -- Sharing
Full card -- same as Following tab pinned cards.
- Badge: avatar, display name, per-card month nav, follow button (pinned right)
- Calendar grid + activity dots
- Activity legend footer
- Diary strip below calendar, respecting `diaryPrivacy` independently (see Diary Strip section)
- Card is tappable (future: profile nav)

### Tier 2 -- Followers
Locked card. All tab always shows locked regardless of follow status.
- Badge: avatar, display name, lock icon, follow button (pinned right)
- Body: lock symbol + "Follow to see their tracker."
- No calendar, no diary, no month nav
- Card is tappable (future: profile nav)

### Tier 3 -- Low key
Signal copy card.
- Badge: avatar, display name, follow button (pinned right). No month nav.
- Body: calendar signal copy headline + "low key" whisper label
- No calendar grid, no diary content
- Card is tappable (future: profile nav)

### Tier 4 -- Ghost
Name-only pill.
- Badge: avatar, display name, "Gone quiet for now." copy
- No follow button, no month nav, no content
- Subtle gold glow
- Card is tappable (future: profile nav)

### Tier 5 -- Private
Not shown. Private cascades: if either `calendarPrivacy` or `diaryPrivacy` is private, the user is excluded entirely.

---

## Diary Strip (Sharing tier only)

When calendar tier is Sharing, a diary strip appears below the calendar card. The diary strip respects `diaryPrivacy` independently:

| Diary tier | Diary strip shows |
|---|---|
| Sharing | Full note + photo (most recent entry for the browsed month) |
| Followers | Full note + photo if viewer follows them; locked diary zone if not |
| Low key | Diary signal copy only (no note, no photo) |
| Ghost | No diary strip |
| Private | Cascades -- whole card hidden (private cascade rule) |

The diary strip is the same component used in Following tab pinned cards (`renderDiaryStrip` in `following-people.js`). Reuse it directly.

---

## Private Cascade Rule

If either `calendarPrivacy` or `diaryPrivacy` is `private`, treat the user as fully private -- exclude from All tab entirely. This is enforced at render time in `tracker-all.js` as a safety net (in addition to being enforced at write time in `privacy-settings.js`).

---

## Card Tap Behavior

All cards are tappable containers. Follow button and month nav use `e.stopPropagation()`.

Current: card tap is a no-op placeholder. Profile navigation activates it when user profiles are built.

---

## Ordering

- Alphabetical A-Z by display name
- No tier-based grouping -- Ghost pills sit in alphabetical position alongside full cards

---

## Data / Firestore Notes

- `calendarPrivacy` and `diaryPrivacy` both read from user doc in `tracker-all.js`
- Tier values: `sharing`, `followers`, `lowkey`, `ghost`, `private`
- Private cascade: if either field is `private`, return null (exclude)
- Per-card month nav fetches: `logs/{yearMonth}/entries/{uid}`
- Diary strip fetches: most recent diary entry for the browsed month

---

## Pass Plan

| Pass | What it builds |
|---|---|
| ✅ Pass 1 | Layout, stat line, search bar, alphabetical order |
| ✅ Pass 2 | Per-card month nav on Sharing cards; global month bar hidden |
| ✅ Pass 3 | Locked card (Followers tier) |
| ✅ Pass 4 | Low key signal copy card |
| Pass 5 | Ghost pill |
| Pass 6 | Diary strip on Sharing cards (tier-aware, reusing Following tab component) |
| Pass 7 | Final wiring -- private cascade, diaryPrivacy enforcement, full tier branching end-to-end |

---

## Files

| File | Role |
|---|---|
| `js/tracker-all.js` | Orchestrator -- snapshot, tier branching, stat line, search |
| `js/tracker-all-cards.js` | `renderLockedCard`, `renderLowKeyCard`, `renderGhostCard` |
| `js/cal-card.js` | `renderMobileCard` -- Sharing full card with per-card month nav |
| `js/following-people.js` | `renderDiaryStrip` -- reused directly for diary strip in Pass 6 |
| `css/cal-card.css` | All card styles |

---

## Relationship to User Profiles

When profiles land:
- Card taps navigate to `/profile/{userId}`
- Locked card CTA evolves to "View profile" -- follow action moves inside profile
- Ghost cards link to profiles showing presence (bio, join date) without content

---

*Spec written by Cii -- April 2026*
