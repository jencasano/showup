# All Tab -- Implementation Spec

## Status: COMPLETE (April 2026)

---

## Overview

The All tab is a **discovery directory** -- a place to find anyone tracking this month, see their status, and follow them. It is not a feed. It is not a social timeline. It is a clean, searchable, alphabetical list of everyone showing up, filtered and styled by their privacy tier.

---

## Relationship to the Following Tab

The All tab uses **the same display rules as the Following tab**, with one difference:

| Tier | Following tab | All tab |
|---|---|---|
| Sharing | Full card (calendar + diary) | Full card (calendar + diary) |
| Followers | Full card (you follow them, so you qualify) | Locked card (random browser doesn't qualify) |
| Low key | Signal copy card | Signal copy card |
| Ghost | Name only + ghost diary zone | Name only + ghost diary zone |
| Private | Not shown | Not shown |

**Three rules that hold across every combination:**
1. A follower always sees the same card in the Following tab and the All tab -- identical every time.
2. Low key and Ghost are audience-agnostic -- signal copy and ghost treatment show the same to followers and strangers.
3. Only the Followers tier discriminates by audience -- strangers get Locked, followers get Full.

---

## Month Navigation

The All tab does **not** use the global month bar. Each Sharing card has its own per-card month nav (prev/next + month label), identical to the Following tab pinned cards.

Low key, Locked, and Ghost cards have no month nav -- Low key users chose to show a curated signal, not historical data; Locked and Ghost have nothing to browse.

The global month bar (shared with Mine) is hidden when the All tab is active.

---

## Tab Structure

### Stat line
> "X people tracking this month"
- Count includes Sharing, Followers, Low key, Ghost -- excludes Private
- Always refers to current calendar month
- Small font, muted color

### Search bar
- Placeholder: "Search people or activities"
- Sharing: searchable by name and activities
- All other tiers: searchable by name only
- No toggle, no filter chips, no sort controls

### Cards
Alphabetical A-Z by display name. No tier-based grouping. Masonry layout fills top-to-bottom per column.

---

## Card States by Privacy Tier

### Sharing
Full card. Same as Following tab pinned cards.
- Badge: avatar, display name, per-card month nav, follow button (pinned right)
- Calendar grid + activity dots
- Activity legend footer
- Diary strip below calendar (see Diary Strip section)

### Followers
Locked card. All tab always shows locked regardless of follow status.
- Badge: avatar, display name, lock icon, follow button (pinned right)
- Body: lock symbol + "Follow to see their tracker."
- No calendar, no diary, no month nav

### Low key
Signal copy card. No month nav.
- Badge: avatar, display name, follow button (pinned right)
- Body: calendar signal copy headline + "low key" whisper label
- No calendar grid
- Diary strip below (see Diary Strip section)

### Ghost
Ghost card. Gold glow border.
- Badge: avatar, display name, follow button
- Body: moon emoji + "Gone quiet for now."
- No calendar, no month nav
- Diary strip below (see Diary Strip section)

### Private
Not shown. Private cascades: if either `calendarPrivacy` or `diaryPrivacy` is private, user is excluded entirely.

---

## Diary Strip

The diary zone is **independent of the calendar zone**. It renders for Sharing, Low key, and Ghost calendar tiers. Only Locked (Followers calendar, stranger) gets no diary zone.

The diary strip renders based solely on `diaryPrivacy`:

| Diary tier | Strip shows |
|---|---|
| Sharing | Full note + photo (most recent entry for browsed month). Returns null if no entry. |
| Followers | Full note + photo if viewer follows them. "Follow to see their diary." if not. |
| Low key | Diary-flavored signal copy. Always shows regardless of diary entry existence. |
| Ghost | Moon emoji + "Gone quiet for now." |
| Private | Cascades -- user excluded entirely before reaching diary strip. |

Implemented in `js/diary-strip.js` -- shared module used by both Following and All tabs.

---

## Private Cascade Rule

If either `calendarPrivacy` or `diaryPrivacy` is `private`, user is excluded from All tab entirely. Enforced at render time in `tracker-all.js` and at write time in `privacy-settings.js`.

Default for users with no privacy fields set: `sharing` for both calendar and diary.

---

## Privacy field storage

Stored on user doc as nested object:
```
privacy: {
  calendar: "sharing" | "followers" | "lowkey" | "ghost" | "private"
  diary:    "sharing" | "followers" | "lowkey" | "ghost" | "private"
}
```

Read in code as: `userData?.calendarPrivacy || userData?.privacy?.calendar || "sharing"`

---

## Files

| File | Role |
|---|---|
| `js/tracker-all.js` | Orchestrator -- snapshot, tier branching, diary fetch, stat line, search |
| `js/tracker-all-cards.js` | `renderLockedCard`, `renderLowKeyCard`, `renderGhostCard` |
| `js/cal-card.js` | `renderMobileCard` -- Sharing full card with per-card month nav |
| `js/diary-strip.js` | `renderDiaryStrip` -- shared module used by Following and All tabs |
| `js/following-signals.js` | `computeSignal` -- signal copy computation |
| `css/cal-card.css` | All card styles |

---

## What's next

- All tab card tap -- currently no-op. Activates when user profiles are built.
- Locked card CTA may evolve to "View profile" when profiles land.
- Diary strip "view full diary" button -- currently shows "Coming soon!" toast.

---

*Spec written by Cii -- April 2026*
