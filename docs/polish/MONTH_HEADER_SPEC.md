# Month Header Polish -- MONTH_HEADER_SPEC.md (PO07)

> Source of truth for upgrading the month header from the current plain sticky bar to the Mixtape editorial style.
> Locked direction: Option A (Editorial inline). Both desktop and mobile. Both themes.

Reference mockup: `mockups/month-header-mockup.html` (Option A / section 01)

---

## 1. Problem

The month header (`#month-bar`) is the last major UI element that hasn't received the Mixtape typography treatment. It's a plain centered sticky bar with the month name in `--font-heading` (which aliases to Fraunces, but at a small size with no italic year accent). It feels generic compared to the editorial personality in the sidebar, tracker badge, and diary notebook.

Additionally, the streak stat ("12 day streak") in the far-right corner of the month bar duplicates information already communicated by the status banner and the My Progress card below.

---

## 2. Goal

Replace the current month bar with an editorial-style month heading that matches the Mixtape design language. Remove the streak from the bar. Add a "day X of Y" temporal counter. Keep all navigation controls (arrows, calendar picker, today button).

---

## 3. Locked direction: Option A (Editorial inline)

### Desktop (768px+)

The month header becomes a left-aligned editorial heading rendered **inside** the My Log content area (inside `.mylog-centered-stack`), not as a separate sticky bar. It scrolls with the content.

**Layout:**
- Top row: month name + nav controls on the same baseline
  - Month name in `--font-display` (Fraunces), ~2rem, font-weight 600, color `--ink`
  - Year as italic `<em>`, font-weight 400, color `--red`
  - Nav arrows (prev/next) as 26px circular buttons with 1px `--hairline` border, `--ink-faint` color, hover to `--red` border + color
  - Calendar picker button, same style as nav arrows
  - Today button (target emoji), same style, only visible when viewing a past month
- Sub-line: "day X of Y" in `--font-mono`, ~0.62rem, color `--ink-faint`, letter-spacing 0.06em
  - X = current day of month (or last day if viewing past month)
  - Y = total days in month
  - Only shown on the My Log tab

**What it replaces:**
- The `#month-bar` element is **hidden on desktop** for the My Log tab (display: none when activeTab === "mylog" on desktop)
- The new heading is rendered by `loadMyLog()` as the first element inside `.mylog-centered-stack`, before the status banner
- For Following and All tabs, the month bar remains hidden as it already is (those tabs hide it today)

### Mobile (<768px)

The month bar stays as a **sticky bar** but gets the Fraunces upgrade.

**Layout:**
- Left side: month name + day counter
  - Month in `--font-display` (Fraunces), ~1.15rem, font-weight 600, color `--ink`
  - Year as italic `<em>`, font-weight 400, color `--red`, slightly smaller (~0.88rem)
  - "day X" in `--font-mono`, ~0.56rem, color `--ink-faint`, inline after the month
- Right side: nav arrows + calendar picker
  - Borderless buttons (same as current mobile), 24px, `--ink-faint` color
  - Today button when viewing past month

---

## 4. What gets removed

### Streak stat in month bar
The `#month-bar-stat` element ("fire emoji + N day streak") is removed entirely. The `updateStat()` function in app.js and its call sites are removed. The `#month-bar-stat` span in index.html is removed. The `#month-bar-spacer` is also removed (it only existed to balance the stat).

**Rationale:** The streak is already surfaced in the status banner ("Keep the momentum rolling") and in the My Progress card's Show-up Days stat. Triple-showing it adds clutter, not information.

### Stats cluster from Mixtape reference
The Mixtape mockup (`mixtape-reference.html`) showed "74% on pace / 5 habits / 12 streak" stats in the header. These are **not implemented** because they duplicate My Progress.

---

## 5. Token mapping

All values resolve to existing design tokens. No new tokens needed.

| Element | Token | Side A | Side B |
|---------|-------|--------|--------|
| Month name | `--ink` | #2A1F1A | #F0DCCF |
| Year italic | `--red` | #C3342B | #F07A5E |
| Day counter | `--ink-faint`, `--font-mono` | #9C8874 | #6E504B |
| Nav button border | `--hairline` | #D4C3A1 | #4A2025 |
| Nav button icon | `--ink-faint` | #9C8874 | #6E504B |
| Nav button hover | `--red` | #C3342B | #F07A5E |
| Bottom border (desktop) | `--hairline`, dashed | #D4C3A1 | #4A2025 |
| Bottom border (mobile) | `--paper-edge`, solid | #DCCFA6 | #3A1D20 |

---

## 6. Files to modify

### index.html
- Remove `#month-bar-spacer` and `#month-bar-stat` spans from the `#month-bar` element
- No other HTML changes needed (the new desktop heading is rendered dynamically by JS)

### css/layout.css
- On desktop (768px+ media query): hide `#month-bar` when `.mylog-active` class is present on `#app-screen` (or use the existing tab-based display:none logic)
- Add styles for the new `.month-heading-editorial` component:
  - `.month-heading-editorial` -- container, padding, dashed bottom border
  - `.mhe-top` -- flex row for month + nav
  - `.mhe-month` -- Fraunces display, 2rem
  - `.mhe-month em` -- italic red year
  - `.mhe-nav` -- flex row for arrow buttons
  - `.mhe-nav button` -- 26px circles with hairline border
  - `.mhe-sub` -- mono sub-line for day counter
- On mobile: update `#month-bar` styles to use Fraunces and the left-aligned layout
  - `.mhe-mobile` variant or update existing `#current-month-label` styling

### js/app.js
- Remove the `updateStat()` function entirely
- Remove all `await updateStat()` calls
- Remove the `monthBarStat` element reference
- On desktop + mylog tab: set `#month-bar` display to none
- On desktop + other tabs: month bar stays hidden (already the case)
- On mobile: month bar always visible (already the case), but update the label rendering to use the new format

### js/tracker-mylog.js
- In `loadMyLog()`, before the status banner, render the new editorial month heading as the first child of `.mylog-centered-stack` (desktop) or update the month bar content (mobile)
- Create a `renderMonthHeading(yearMonth, isCurrentMonth)` function that builds the heading DOM
- The heading includes: month name with italic year, prev/next arrows, calendar picker button, today button (conditionally), and "day X of Y" sub-line
- Wire up click handlers on the nav buttons to call the existing `changeMonth()` function (import or dispatch via a callback)

### js/utils.js
- Add a `getDayOfMonth()` helper if one doesn't exist, or just use `new Date().getDate()` inline

---

## 7. Behavioral details

### Day counter logic
- Current month: "day {today's date} of {days in month}" (e.g., "day 24 of 30")
- Past month: "day {days in month} of {days in month}" (e.g., "day 30 of 30") -- or omit the counter entirely for past months. Decision: **omit for past months** (the counter is motivational, not historical).
- Only shown on the My Log tab.

### Month navigation
- Prev button: always enabled
- Next button: disabled when viewing current month (same as today)
- Calendar picker: opens the existing month picker overlay
- Today button: only visible when viewing a past month, jumps to current month
- All handlers delegate to the existing `changeMonth()` logic in app.js

### Tab switching
- When switching to My Log on desktop, the month bar hides and the editorial heading appears
- When switching away from My Log on desktop, the editorial heading is gone (it's inside tab-mylog) and the month bar would show -- but Following and All already hide it, so no conflict
- On mobile, the month bar is always visible regardless of tab, with the Fraunces upgrade applied globally

### Status banner
- Unchanged. Still renders between the month heading and the tracker card, current month only.

---

## 8. Verify

- Side A desktop: Fraunces heading, italic red year, day counter, dashed border, nav buttons with hairline borders
- Side B desktop: same layout, all colors auto-swap via tokens
- Mobile Side A: left-aligned Fraunces in sticky bar, day counter inline, nav on right
- Mobile Side B: same, colors auto-swap
- Nav arrows work (prev/next month)
- Calendar picker opens
- Today button appears only on past months
- Next button disabled on current month
- Streak stat is gone from the month bar on all viewports
- Status banner still shows on current month
- Following and All tabs unaffected
- Past months: day counter hidden, everything else works

---

## 9. What NOT to do

- Do not add stats (on-pace %, habits, streak) to the month heading. They duplicate My Progress.
- Do not make the desktop heading sticky. It scrolls with content.
- Do not change the status banner. It stays as-is.
- Do not change the month bar on Following or All tabs. Those tabs already hide it.
- Do not add the streak stat back anywhere. It's removed.

---

*PO07. Built by Jen & Cii* 🪨
