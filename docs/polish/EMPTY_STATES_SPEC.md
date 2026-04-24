# Empty States -- EMPTY_STATES_SPEC.md (PO07)

> Source of truth for showup.'s empty state visual treatment, copy, and behavior.
> Applies a unified "Quiet Room" treatment across all empty surfaces.

Reference mockup: `mockups/empty-states-mockup.html`

---

## 1. Problem

Empty states across the app are inconsistent and plain. Some use emojis and h3 headings, some are unstyled `<p>` tags, some have dashed borders. None of them feel like showup. The ambient texture (drifting motifs, warmth glow) that gives the app its atmosphere stops at every empty state, creating dead zones.

---

## 2. Design concept: the Quiet Room

Every empty state is a room that's been set up and is waiting. Not broken, not sad, not missing data. Just quiet.

Three layers, progressively applied depending on the surface:

1. **Ambient motif backdrop** -- the same drifting stars/dots/squiggles from `.ambient` in base.css, rendered as a contained background inside the empty state container. Low opacity (0.35), 70s drift. Plus a warmth glow (radial gradients, 55s drift). Makes the empty state feel alive.

2. **Fraunces italic headline** -- every empty state gets a single line of copy in Fraunces italic, `--ink-soft` color. Below it, an optional subtitle in Manrope `--ink-faint`.

3. **Dashed-border action frame (optional)** -- when there is a CTA (like "Browse All"), it lives inside a dashed-border rounded rect. The dashed border says "this space could be filled."

---

## 3. Treatment tiers

Not every empty state gets all three layers.

| Tier | When to use | Layers |
|------|-------------|--------|
| **Full Quiet Room** | Big standalone empty surfaces (feed empty, people tab empty, all tab empty/search empty) | All three: motif backdrop + warmth glow + Fraunces headline + optional action frame |
| **Nudge card** | Persistent CTA inside a populated view (bottom of People sidebar) | Dashed border + subtle motif (0.2 opacity) + Fraunces headline + compact CTA |
| **Inline empty** | Small section empties within a populated view (Showing Up = 0, Pinned = 0) | Fraunces italic line only. No backdrop, no frame. |
| **Diary context** | Inside the diary modal (blank page) | Motif backdrop (subtler) + Caveat headline + ruled lines + dashed "write" button |

---

## 4. Surface inventory

Eight surfaces total.

### 4.1 Feed empty (Full Quiet Room)

**When:** User follows people but nobody has logged today.
**Where:** `js/following-feed.js` `renderEmptyState()`
**New:** Full Quiet Room with dashed action frame.

**Copy:**
- Headline: "nothing new. everyone's quiet today."
- Subtitle: "check back later, or find more people to follow."
- Action frame: "Browse All" button + hint "see who else is showing up"
- Mobile: same copy, action frame omits the hint text (just the button)

### 4.2 People tab empty -- zero follows (Full Quiet Room)

**When:** User hasn't followed anyone (`allEmpty` is true).
**Where:** `js/following-people.js` when `allEmpty` is true.
**New:** Full Quiet Room with dashed action frame. Replaces the entire People view.

**Copy:**
- Headline: "nobody here yet."
- Subtitle: "head to the All tab to find people who are showing up."
- Action frame: "Browse All" button + hint "discover who's tracking"

### 4.3 Showing Up section empty (Inline empty -- context-aware)

**When:** No unpinned active users.
**Where:** `js/following-people.js`, the Showing Up section in the sidebar.
**New:** Inline Fraunces italic. No backdrop. Copy depends on whether Pinned cards exist.

**Copy (context-aware):**
- If `pinnedActive.length > 0`: "all pinned."
- If `pinnedActive.length === 0`: "no one else showing up this month."

The distinction matters because "no one else showing up this month" is misleading when everyone active is simply pinned to the left. "all pinned." is factual and layout-agnostic.

### 4.4 Pinned section empty (Inline empty)

**When:** User has follows but none are pinned (`pinnedActive.length === 0` and `allEmpty` is false).
**Where:** `js/following-people.js`, the Pinned section in the main column.
**New:** Render the Pinned section label (without the Unpin All button) followed by an inline empty. This fills the left column so the two-column layout doesn't look broken, and teaches new users what pinning does.

**Copy:**
- "pin someone to keep them here."

### 4.5 Crickets section empty (Not rendered)

**When:** All followed users have trackers this month (no crickets).
**Where:** `js/following-people.js`, the Crickets section.
**New:** Do not render the Crickets section at all when count is 0. The absence of the section is the message. No empty state needed.

**Behavior:** Only render the Crickets section label and rows when `crickets.length > 0`.

### 4.6 All tab empty (Full Quiet Room, no action frame)

**When:** Search returned no results, or the month has zero trackers.
**Where:** `js/tracker-all.js` `renderAllList()`.
**New:** Full Quiet Room without action frame.

**Copy (search empty):**
- Headline: "nothing matching that."
- Subtitle: "try a different name or activity."

**Copy (no trackers):**
- Headline: "no other trackers yet for this month."
- Subtitle: "give it a few days."

### 4.7 Diary blank page (Diary context)

**When:** User taps a day with no diary entry in the open diary modal.
**Where:** `js/tracker-diary.js` inside `selectDay()`, the `else` branch.
**New:** Motif backdrop (subtler), Caveat headline, faint ruled lines suggesting a blank notebook page, dashed "write something" button.

**Copy:**
- Date: "Wednesday, 16" (day of week + bold day number in --red)
- Headline (Caveat): "this page is blank..."
- Visual: three faint ruled lines in --hairline at 0.5 opacity
- Button: dashed border, "write something" with pencil emoji

### 4.8 Browse Nudge card (Nudge card)

**When:** Always visible at the bottom of the People view sidebar, even when user has follows.
**Where:** `js/following-people.js` `renderBrowseNudge()`.
**New:** Dashed border, subtle motif backdrop (0.2 opacity), Fraunces italic copy, compact CTA.

**Copy:**
- Headline: "find more people to follow."
- Subtitle: "see who else is showing up this month."
- Button: "Browse All"

---

## 5. CSS implementation

### Shared class: `.quiet-room`

A new reusable class that provides the Full Quiet Room treatment. Add to a shared CSS file (recommend `css/ui.css` alongside toast/loader, or a new `css/empty-states.css`).

**Structure:**
- Container: relative, flex column, centered, rounded, overflow hidden
- `::before` pseudo-element: motif SVG background, 420px tile, 70s drift animation, 0.35 opacity. Uses the same SVG patterns from `.ambient` in base.css. Theme-aware via `[data-theme]` selectors.
- `::after` pseudo-element: warmth glow radial gradients, 55s drift. Theme-aware.
- Content sits above via `position: relative; z-index: 1`.

**Typography:**
- Headline: Fraunces italic 500, 1.15rem, `--ink-soft` color
- Subtitle: Manrope 400, 0.78rem, `--ink-faint` color
- Both scale down slightly on mobile (1.05rem / 0.74rem)

**Action frame:**
- 1.5px dashed border in `--hairline`
- border-radius: 10px
- Contains button (pill, --red bg, white/--paper text) + optional hint text (italic, --ink-faint)

### Inline empty class: `.inline-empty`

Simple centered text container. Fraunces italic 400, 0.82rem, `--ink-faint` color. No pseudo-elements.

### Nudge card class: `.nudge-card` (replaces `.fw-nudge-card`)

Dashed border container with subtle motif. Same `::before` motif pattern as `.quiet-room` but at 0.2 opacity. Fraunces italic headline, Manrope subtitle, compact CTA button.

### Diary empty

Keeps its existing class names (`.diary-modal-empty-date`, `.diary-modal-empty-text`) but updates styling:
- Headline switches from Manrope to Caveat
- Add ruled lines (three `<div>` elements, 1px height, `--hairline` at 0.5 opacity)
- Write button gets dashed border treatment
- Wrapping container gets the `.quiet-room` motif backdrop

### Animations

Reuse the existing `@keyframes drift-motifs` and `@keyframes drift-warmth` from base.css. If they are not already globally available (they are -- defined in base.css and loaded on every page), no new keyframes needed.

Respect `@media (prefers-reduced-motion: reduce)` -- disable the drift animations on the empty state pseudo-elements, same as the ambient layer.

---

## 6. JS implementation

### Feed empty (`following-feed.js`)

Update `renderEmptyState()` to use the `.quiet-room` class structure instead of the current emoji + h3 approach. Remove the emoji. Add the motif backdrop via the CSS class. Add the dashed action frame with "Browse All" button.

### People view (`following-people.js`)

Five behaviors:

1. When `allEmpty` is true, render a Full Quiet Room with "nobody here yet." copy and dashed action frame.
2. When `pinnedActive.length === 0` (but not allEmpty), render the Pinned section label + inline empty "pin someone to keep them here."
3. The Showing Up section: when `activeUnpinned.length === 0`, render context-aware inline empty. If `pinnedActive.length > 0`, copy is "all pinned." Otherwise "no one else showing up this month."
4. The Crickets section: only render when `crickets.length > 0`. When count is 0, skip entirely.
5. `renderBrowseNudge()`: uses `.nudge-card` class with Fraunces italic copy.

### All tab (`tracker-all.js`)

Update the empty `<p>` creation in `renderAllList()` to use `.quiet-room` structure. Two copy variants: search-empty (with query echo) and no-trackers.

### Diary (`tracker-diary.js`)

Update the `else` branch in `selectDay()` to add ruled lines and switch the headline to Caveat. Add `.quiet-room` wrapper around the right-page content for the motif backdrop.

---

## 7. Copy conventions

All empty state copy follows MIXTAPE_SPEC.md Section 2 and TOAST_SPEC.md Section 6:

- Intentionally lowercase for intimacy
- Period at the end (except diary's ellipsis "this page is blank...")
- No em-dashes
- No exclamation points
- No emojis in headlines (emojis removed from empty states; the motif backdrop replaces them as the visual element)
- No "Oops!", "Whoops!", startup cheerfulness
- Specific, not generic

---

## 8. Full copy inventory

| Surface | Copy |
|---------|------|
| Feed empty | "nothing new. everyone's quiet today." / "check back later, or find more people to follow." |
| People empty (zero follows) | "nobody here yet." / "head to the All tab to find people who are showing up." |
| Showing Up = 0, has pinned | "all pinned." |
| Showing Up = 0, no pinned | "no one else showing up this month." |
| Pinned section empty | "pin someone to keep them here." |
| Crickets = 0 | section not rendered. no copy needed. |
| All tab, search no results | "nothing matching that." / "try a different name or activity." |
| All tab, no trackers | "no other trackers yet for this month." / "give it a few days." |
| Diary blank page | "this page is blank..." / (ruled lines + "write something" button) |
| Browse Nudge card | "find more people to follow." / "see who else is showing up this month." |

---

## 9. Migration checklist

### Step 1: Add CSS

Add `.quiet-room`, `.inline-empty`, and updated `.nudge-card` styles to `css/ui.css`.

Include `[data-theme="side-b"]` variants for the motif SVG background (salmon/teal/yellow pattern instead of red/blue/yellow).

Include `@media (prefers-reduced-motion: reduce)` to disable drift animations.

### Step 2: Update JS

- `following-feed.js` -- update `renderEmptyState()`
- `following-people.js` -- all five behaviors from Section 6
- `tracker-all.js` -- update empty state in `renderAllList()`
- `tracker-diary.js` -- update blank page rendering in `selectDay()`

### Step 3: Clean up old styles

- Remove `.following-empty` styles if they exist (feed empty state)
- Update `.fw-nudge-card` to `.nudge-card` or alias
- Remove `.fw-section-empty` references (unstyled `<p>` class)
- The `.empty-state` class in tracker.css can stay as a fallback but should no longer be used by the surfaces covered in this spec

### Step 4: Verify

- Test all eight surfaces on Side A
- Test all eight surfaces on Side B
- Confirm motif backdrop animates and is theme-aware
- Confirm Crickets section does not render when count is 0
- Confirm Pinned empty shows "pin someone to keep them here." when no pins
- Confirm Showing Up empty shows "all pinned." when pinned cards exist
- Confirm reduced-motion preference disables drift animations
- Confirm mobile sizing is correct
- Confirm copy matches the inventory in Section 8

---

## 10. Future considerations

### More empty states

As new features ship (user profiles, shop, notifications), each will have its own empty states. Use the Quiet Room treatment tier system: Full for standalone, Inline for sections, Nudge for persistent CTAs.

### Empty state illustrations

The motif backdrop replaces emojis as the visual element. If showup. ever invests in custom illustrations (hand-drawn, matching the motif style), they would replace the motif backdrop layer, not the copy or action frame layers.

### Milestone empty states

When milestone cards ship (backlog item 12), the first-ever-entry state and comeback-after-absence state could use a celebratory variant of the Quiet Room with a warmer glow and a success-green accent. Not needed now.

---

*PO07. Built by Jen & Cii* 🪨
