# Diary Tab Spec

> Adds a dedicated diary tab to showup. -- the "reading room" for your
> personal diary. Accessible from sidebar (desktop) and bottom nav (mobile).
> Mockup: mockups/diary-tab-mockup.html

---

## Overview

The diary currently lives as a widget inside the Mine tab (closed notebook
on desktop, card on mobile) and opens as modals/sheets. There is no
standalone diary page. This spec adds one.

The diary tab is a scrollable page with three sections:
1. Notebook hero -- the closed notebook + a write CTA
2. This month's pages -- fill bar + mini page grid
3. Past months bookshelf -- notebook spines on a wooden shelf

The tab is personal and read-focused. Writing still happens through the
existing diary modal/sheet overlays -- the tab just gives you a way to
browse and enter them.

---

## Infrastructure Changes

### HTML (index.html)

Add a new tab panel inside #app-content, alongside the existing three:

    <div id="tab-diary" class="tab-panel" style="display:none;"></div>

Change the sidebar diary nav item from data-action="diary" to
data-tab="diary".

Change the mobile bottom nav diary button from data-action="diary" to
data-tab="diary".

### App logic (js/app.js)

Diary becomes a real tab (like mylog, following, all) instead of an action.

- Import a loadDiaryTab function from a new js/tracker-diary-tab.js.
- Add a ref for the tab-diary element.
- In switchTab(): handle "diary" -- show/hide the panel, hide month bar
  (same as following/all), apply the active class to sidebar + bottom nav.
- In loadActiveTab(): when activeTab === "diary", call loadDiaryTab.
- Remove the openDiaryFromNav function entirely. The sidebar handler for
  data-action="diary" (which showed a toast) is also removed -- diary now
  goes through the standard switchTab flow.

### New file: js/tracker-diary-tab.js

All diary tab rendering logic lives here. Single export: loadDiaryTab.

### Styles

Add diary tab styles to css/diary-book.css under a new "DIARY TAB" section
comment at the end of the file. Reuse existing diary-mini-page class family
for the pages grid. New classes for the tab-specific layout (hero, section
heads, fill bar, bookshelf).

---

## Section 1: Notebook Hero

A flex row on desktop, stacked column on mobile.

### Left side: Closed notebook

Reuse renderDiaryNotebook from js/tracker-diary.js -- it already returns
a fully styled DOM element with click handler, palette button, and cover
support. Render it at roughly 180x240px on desktop, 140x190px on mobile.

Fetch the active cover using the same pattern as tracker-mylog.js:
getDiaryCover + getMonthCover + getActiveCover.

Clicking the notebook opens the existing diary modal (openDiaryModal)
just like it does on the Mine tab today.

### Right side: Text + CTA

- Title: "your diary." -- Fraunces italic, 1.6rem desktop, 1.3rem mobile,
  var(--ink).
- Subtitle: "{MonthName} {Year} -- {N} pages filled so far. keep going."
  -- 0.72rem, var(--ink-faint). If zero entries: "no pages yet. start
  writing."
- CTA button: pencil emoji + "write today's page" -- Sora 0.72rem bold,
  white text on var(--red) background, rounded 10px, 9px 20px padding.
  On click: open the diary write view for today. On desktop, open
  openDiaryModal with initialDay set to today. On mobile, open
  openMobileDiarySheet.

On mobile the hero centers the notebook above the text block.

---

## Section 2: This Month's Pages

### Section header

Flex row with "this month's pages" on the left (Fraunces 1rem, var(--ink))
and "{MonthName} {Year}" on the right (DM Mono 0.58rem, var(--ink-faint)).
Separated by a dashed border-bottom in var(--hairline).

### Fill bar

Horizontal flex row with three elements:
- Left label: "X of Y" in DM Mono, 0.52rem, var(--ink-faint).
  X = diary entries count. Y = today's date for current month,
  or days-in-month for past months.
- Track: 3px tall, var(--hairline) background, var(--yellow) fill.
  Width = (X / Y) * 100%.
- Right label: percentage in DM Mono, 0.52rem, var(--yellow).

### Pages grid

5 columns on desktop, 4 columns on mobile. Gap: 8px desktop, 6px mobile.

Each day from 1 through today (no future days) gets a mini page card.
Aspect ratio 3:4.

Reuse the rendering pattern from openDiaryPagesModal in tracker-diary.js.
The mini page card styles already exist in css/diary-book.css (the
diary-mini-page class family from the mobile pages view). Override the
grid column count for the tab context.

#### Filled pages (has diary entry)

- Dotted notebook background (slightly lighter than empty)
- Yellow-tinted border
- Day number: Fraunces italic, 0.72rem, bold
- Note preview: Caveat cursive, 0.5rem, 2-line clamp
- Photo thumbnail: polaroid at bottom, aspect-ratio 1:1, object-fit cover
- Amber dot: 4-5px circle in top-right corner, var(--yellow)
- Tap: opens diary modal at that day (openDiaryModal with initialDay)

#### Empty pages (no diary entry)

- var(--paper-deep) background, var(--hairline) border
- Opacity 0.3
- Three faint ruled lines below day number (decorative)
- Tap: no-op (or optionally open write view for that day)

#### Today's page

- Border: var(--red), with 1px box-shadow ring in red
- Day number color: var(--red)
- Applies whether filled or empty

### Data

Use getDiaryDays() for the Set of filled days. Use getDiaryEntry() for
filled page content (note preview + photo). Share or mirror the
_diaryEntryCache from tracker-diary.js to avoid redundant fetches.

Stagger the filled page fade-in: each filled page fades in with a 25ms
delay, capped at 200ms total.

---

## Section 3: Past Months Bookshelf

### Section header

Same style as section 2: "past months" left, "your bookshelf" right.

### The shelf

A wooden bookshelf with notebook spines standing upright, one per past
month that has at least one diary entry. Newest month on the left,
oldest on the right.

Structure (three layers, top to bottom):
1. Scroll wrapper -- horizontally scrollable, hidden scrollbar
2. Shelf plank -- the back wall + the books standing on it
3. Shelf surface -- the wooden plank edge below the books
4. Shelf label -- "newest <- -> oldest" in DM Mono, right-aligned

### Shelf plank (back wall)

The plank is a flex row aligned to the bottom (books stand on it).
Background is a muted wall color (var(--shelf-wall)). Rounded top corners.
Min-height: 140px desktop, 120px mobile. The plank uses min-width:
min-content so it grows beyond the container when there are many books,
and the scroll wrapper handles the overflow.

### Shelf surface (wooden plank)

A 12px tall bar below the books that looks like a wooden shelf edge.
Stays full-width (does not scroll). Uses theme-aware tokens:

- Side A: warm tan (#C9B890 body, #B8A67A highlight)
- Side B: dark mahogany (#3A1D20 body, #4A2528 highlight)

Top 3px is a lighter highlight strip. Subtle wood grain texture via
repeating-linear-gradient. Drop shadow underneath.

### Book spines

Each past month with diary entries renders as a vertical book spine.

Dimensions: ~38px wide, ~110px tall on desktop. ~34px wide, ~95px tall
on mobile. Height and width vary by entry count for visual character:

- h-tall / h-medium / h-short classes for height variation
- w-thick / w-thin classes for width variation
- Books with more entries should generally be taller/thicker

Visual treatment:
- Background: the coverGradient from DIARY_COVERS for that month's cover
  (fetched from the month's log doc diaryCover field, with user default
  fallback)
- Leather texture: repeating diagonal gradient overlay (same as closed
  notebook)
- Top band: subtle rgba(255,255,255,0.08) highlight
- Bottom band: subtle rgba(0,0,0,0.12) shadow strip
- Box shadow: 2px 2px 6px rgba(0,0,0,0.25) + inset shadows for depth
- Border-radius: 3px 5px 4px 2px (slight asymmetry like a real book)

Spine content (all vertically oriented via writing-mode: vertical-rl):
- Two small decorative dots at the top (3px circles, rgba white)
- Month label in Fraunces italic, 0.52rem (desktop) / 0.46rem (mobile)
- Entry count at the bottom in DM Mono, 0.38rem

For light-colored covers (e.g. Quiet/cream): text color switches to
rgba(42,31,26,0.7) instead of white. Use a "light-cover" class.

Slight lean: nth-child rotation offsets (-0.8deg, 0.5deg, -0.3deg) so
books don't look perfectly aligned.

Hover: translateY(-12px) rotate(-2deg) with an elevated shadow. On
desktop, show a tooltip above the book with "{Full Month Name} {Year} --
{X} of {Y} pages".

Tap: opens that month's diary pages modal (openDiaryPagesModal with the
past month's yearMonth, diaryDays, and cover).

### Data for bookshelf

The bookshelf needs to know which past months have diary entries and
what cover each month used. Two approaches:

**Option A (simple, more reads):** Scan backward from the month before
the current one. For each month, call getDiaryDays(). If the set is
non-empty, add it to the shelf. Stop after 12 months or 3 consecutive
empty months.

**Option B (optimized, future):** Store a diary month index on the user
doc listing months with entries. This avoids scanning. Can be added later.

Start with Option A. Cache the results so switching tabs doesn't re-fetch.

### Empty state

If no past months have diary entries, show a Caveat cursive message:
"your bookshelf is empty. keep writing and it will fill up." Centered,
var(--ink-faint), 0.9rem.

---

## Responsive Behavior

Mobile breakpoint: 767px (consistent with existing code).

- Hero: row on desktop, centered column on mobile
- Pages grid: 5 columns desktop, 4 columns mobile
- Bookshelf: spines are smaller on mobile (34x95px vs 38x110px), shelf
  scrolls horizontally when books overflow
- Month bar: hidden on diary tab (same as following/all tabs)
- Bottom nav: diary tab gets the active treatment (ink bg + paper text)

---

## Side B Theme Support

All components use CSS custom properties from variables.css so they
automatically adapt to Side B. The bookshelf has additional theme-aware
tokens:

- --shelf-bg: #C9B890 (A) / #3A1D20 (B)
- --shelf-top: #B8A67A (A) / #4A2528 (B)
- --shelf-shadow: rgba(42,31,26,0.18) (A) / rgba(0,0,0,0.4) (B)
- --shelf-wall: rgba(220,207,166,0.4) (A) / rgba(58,29,32,0.5) (B)

These go in css/variables.css alongside the other design tokens.

---

## What This Does NOT Do

- No writing interface -- writing stays in the diary modal/sheet overlays
- No month navigation on the diary tab -- it always shows the current
  month's pages. Past months are accessed via the bookshelf.
- No changes to the Mine tab -- the notebook widget stays there too
- No changes to the mobile diary sheet -- it still opens from the write
  CTA and from tapping pages
- No social features -- this is 100% personal, your own diary
- No new Firestore collections -- reads from existing diary/ and logs/
  paths

---

## Implementation Order

Chunk 1: Infrastructure + hero + pages grid
- HTML changes (new tab panel, nav attribute changes)
- app.js changes (diary as real tab, remove openDiaryFromNav)
- New tracker-diary-tab.js with hero + pages grid sections
- Diary tab styles in diary-book.css

Chunk 2: Bookshelf
- Bookshelf rendering in tracker-diary-tab.js
- Bookshelf styles in diary-book.css
- Shelf theme tokens in variables.css
- Past month scanning logic

---

*Spec written May 2026. Part of Diary Phase B.*
