# Mobile Diary Pages Grid Spec

> Adds a Pages view to the mobile diary sheet, accessible via a new icon in the
> date strip. Inline swap approach (Option B from mockup).
> Mockup: mockups/mobile-diary-pages-v3.html

---

## Overview

The mobile diary currently only has a Calendar view: a horizontal date strip
with a flip card showing one day's entry at a time. There is no way to see
all your diary pages at a glance on mobile. The desktop already has an "All
Pages" grid (openDiaryPagesModal in tracker-diary.js). This spec brings that
concept to mobile as an inline view toggle.

---

## Entry Point

A new icon button is added to the date strip row, next to the existing
calendar icon button. Two icons sit at the right end of the strip:

- 📅 Calendar (existing) -- opens the mini calendar bottom sheet
- 📄 Pages (new) -- toggles the pages grid view

The icons sit in a small flex container at the right edge of the date strip
row, replacing the space of roughly one date pip. Both icons use the same
size and style (mob-diary-cal-btn class or similar). The pages icon gets an
"active" highlight treatment (yellow tint, subtle background) when the pages
view is showing.

---

## Behavior: Inline Swap

Tapping the pages icon does NOT open a bottom sheet or a new modal. Instead,
it replaces the entry area below the date strip (the flip card, date heading,
chips, write/edit button) with the pages grid + fill bar. The date strip
itself stays visible at the top.

This is a view toggle:
- Default state: entry area visible (current behavior)
- Pages active: entry area hidden, pages grid visible
- Tapping the pages icon again: pages grid hidden, entry area restored
- Tapping a filled page in the grid: pages grid hidden, entry area restored
  and navigated to that day (calls selectDay)

The swap should have a subtle crossfade transition (opacity 0 to 1, ~200ms)
rather than an instant swap.

---

## Pages Grid Layout

3-column CSS grid inside a scrollable container that fills the remaining
height of the diary sheet (below the date strip, above the bottom bar).

Gap: 7-8px between pages.
Padding: 6px horizontal, 14px bottom.
Background: dotted notebook pattern (same as the entry area).

---

## Mini Page Cards

Each day from 1 through today (no future days) gets a mini page card.
Aspect ratio 3:4 (portrait notebook page).

### Filled pages (has diary entry)

- Background: var(--bg) (slightly lighter than empty)
- Border: yellow-tinted (color-mix of yellow and hairline)
- Day number: Fraunces serif, 0.72rem, bold, var(--text)
- Note preview: Caveat cursive, 0.5rem, var(--text-muted), 2-line clamp
- Photo thumbnail: if entry has a photoUrl, show a small polaroid at the
  bottom of the card (margin-top: auto, aspect-ratio 1:1, white border,
  object-fit cover)
- Amber dot: 5px circle in top-right corner, var(--yellow)
- Tap action: switch back to entry view, navigate to that day

### Empty pages (no diary entry)

- Background: var(--bg-surface)
- Border: var(--border)
- Opacity: 0.35
- Day number: same as filled
- Three faint ruled lines below the day number (decorative, suggesting
  an empty notebook page)
- Tap action: optionally open the write view for that day, or do nothing

### Today's page

- Border: var(--red), with a 1px box-shadow ring in red
- Day number color: var(--red)
- Whether filled or empty, today always has the coral outline

---

## Fill Bar

Sits between the date strip and the pages grid. Shows diary fill progress.

Layout: horizontal flex row with three elements:
- Left label: "X of Y" in DM Mono, 0.48rem, var(--text-faint)
  where X = diary entries count, Y = today's date (not days in month)
- Track: 3px tall, var(--border) background, var(--yellow) fill
- Right label: percentage in DM Mono, 0.48rem, var(--yellow)

Padding: 6px 18px top, 4px bottom.

The denominator is today's date so the percentage reflects what you could
have written, not the whole month. On May 24, "8 of 24" means 33%.

---

## Data Source

The pages grid reads from the same diaryDays Set that the mobile diary sheet
already fetches (getDiaryDays in diary.js). For filled pages that need note
preview and photo thumbnail, fetch diary entries lazily: only load entries
that are visible in the grid viewport, or load all at once if the count is
small (under 15 entries). The desktop Pages modal already uses a cache
(_diaryEntryCache in tracker-diary.js) -- reuse or mirror that pattern.

Stagger the filled page fade-in for a nice visual effect: each filled page
fades in with a 25ms delay per page, capped at 200ms total.

---

## Implementation Location

All changes go in js/diary-mobile.js inside the openMobileDiarySheet
function, since that is where the date strip, entry area, and flip card
are already built.

New elements to add:
1. Pages icon button in the strip-row (next to the existing calBtn)
2. A pages container div (sibling to entryArea) that holds the fill bar
   and the scrollable pages grid
3. Toggle logic: clicking the pages icon hides entryArea and shows the
   pages container (and vice versa)
4. Page tap handler: hide pages container, show entryArea, call
   selectDay(d)

CSS can go in css/diary-book.css where the existing mobile diary styles
live.

---

## What This Does NOT Do

- No swipe between diary pages (that is the other half of Phase B)
- No changes to the desktop diary (it already has the Pages modal)
- No new Firestore reads (uses existing getDiaryDays + getDiaryEntry)
- No changes to the mini calendar bottom sheet (it stays as-is)
- No fill bar on the Calendar view (only shows when Pages is active)

---

*Spec written May 2026. Part of Diary Phase B.*
