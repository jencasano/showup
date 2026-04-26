# Color Audit -- COLOR_AUDIT_SPEC.md (PO09)

> Source of truth for migrating all hard-coded Tailwind hex values in the progress/stats
> and full-week calendar sections to Mixtape-derived semantic tokens.
> Covers pace badges, progress bar fills, status pills, fw-badges, fw-overlay, and
> the over-target glow. All colors auto-swap per theme after this change.

Reference mockup: `mockups/color-audit-mockup.html`

---

## 1. Problem

The My Progress card and full-week calendar use dozens of hard-coded Tailwind hex values
(#22C55E, #F59E0B, #EF4444, #15803d, #4338ca, #0e7490, #fb923c, #86efac, etc.) that
don't exist in the Mixtape palette. They bypass the design token system, so:

1. **Side B is broken.** Badge backgrounds stay the same on both themes; only text color
   gets a one-off `[data-theme="side-b"]` override. Washes and borders never swap.
2. **Progress bars use inline styles.** The JS in tracker-summary.js calculates a
   `barColor` hex and applies it via `style="background:..."`, making it impossible
   for CSS to control.
3. **The fw-empty overlay uses a dark navy backdrop** (`rgba(30, 35, 60, 0.75)`) on
   both themes. On Side A cream, it looks like a bruise. The CSS also references
   `[data-theme="light"]` (the old theme name, not `side-a`).
4. **--color-success doesn't exist.** Multiple places reference `var(--color-success, #22C55E)`
   but that token was never added to variables.css. The fallback always fires.

---

## 2. Goal

Replace every hard-coded color with semantic tokens that auto-swap per theme.
Remove all inline color assignments from JS. Remove all `[data-theme="light"]`
selectors (old theme name). Remove the phantom `--color-success` references.

---

## 3. New tokens

All tokens added to `css/variables.css`. No new hex values -- everything derives from
existing palette colors (--green, --yellow, --red, --blue, --paper).

### 3a. Status tiers (three-tier system)

Shared by progress bar fills, fw-badges, fw-legend, summary-week-chips, and fw-dots.

| Token | Side A | Side B | Derives from |
|-------|--------|--------|--------------|
| `--status-hit` | #3E5C3A | #5EAAA8 | --green |
| `--status-hit-wash` | rgba(62, 92, 58, 0.12) | rgba(94, 170, 168, 0.14) | --green wash |
| `--status-hit-border` | rgba(62, 92, 58, 0.35) | rgba(94, 170, 168, 0.40) | --green border |
| `--status-caution` | #B8860B | #E8B33A | dark gold / --yellow |
| `--status-caution-wash` | rgba(184, 134, 11, 0.10) | rgba(232, 179, 58, 0.12) | gold wash |
| `--status-caution-border` | rgba(184, 134, 11, 0.30) | rgba(232, 179, 58, 0.32) | gold border |
| `--status-miss` | #C3342B | #F07A5E | --red |
| `--status-miss-wash` | rgba(195, 52, 43, 0.10) | rgba(240, 122, 94, 0.12) | --red wash |
| `--status-miss-border` | rgba(195, 52, 43, 0.30) | rgba(240, 122, 94, 0.32) | --red border |

**Why dark gold (#B8860B) on Side A instead of --yellow (#E8B33A)?**
--yellow is too bright against cream for text/fills. #B8860B is a darkened gold that
reads well on cream. On Side B, --yellow (#E8B33A) works fine against the dark maroon
background, so we use it directly.

### 3b. Pace badges (five states)

| Token | Side A | Side B | Derives from |
|-------|--------|--------|--------------|
| `--pace-ahead` | #3E5C3A | #5EAAA8 | --green |
| `--pace-ahead-wash` | rgba(62, 92, 58, 0.12) | rgba(94, 170, 168, 0.14) | |
| `--pace-ahead-border` | rgba(62, 92, 58, 0.35) | rgba(94, 170, 168, 0.40) | |
| `--pace-ontrack` | #4F6C8E | #5EAAA8 | --blue |
| `--pace-ontrack-wash` | rgba(79, 108, 142, 0.12) | rgba(94, 170, 168, 0.10) | |
| `--pace-ontrack-border` | rgba(79, 108, 142, 0.30) | rgba(94, 170, 168, 0.30) | |
| `--pace-behind` | #C3342B | #F07A5E | --red |
| `--pace-behind-wash` | rgba(195, 52, 43, 0.10) | rgba(240, 122, 94, 0.12) | |
| `--pace-behind-border` | rgba(195, 52, 43, 0.30) | rgba(240, 122, 94, 0.32) | |
| `--pace-early` | #4F6C8E | #5EAAA8 | --blue (muted) |
| `--pace-early-wash` | rgba(79, 108, 142, 0.08) | rgba(94, 170, 168, 0.08) | |
| `--pace-early-border` | rgba(79, 108, 142, 0.25) | rgba(94, 170, 168, 0.25) | |
| `--pace-started` | #3E5C3A | #5EAAA8 | --green (muted) |
| `--pace-started-wash` | rgba(62, 92, 58, 0.08) | rgba(94, 170, 168, 0.08) | |
| `--pace-started-border` | rgba(62, 92, 58, 0.25) | rgba(94, 170, 168, 0.25) | |

### 3c. Full-week overlay

| Token | Side A | Side B |
|-------|--------|--------|
| `--fw-overlay` | rgba(244, 236, 216, 0.88) | rgba(42, 21, 24, 0.88) |

Side A = cream frosted glass. Side B = maroon frosted glass.

---

## 4. Files to modify

### css/variables.css

Add all tokens from Section 3 to the `:root` / `[data-theme="side-a"]` block and
the `[data-theme="side-b"]` block.

Also add these convenience aliases that multiple components share:

```
/* Progress bar fills (alias the status tiers) */
--bar-hit:     var(--status-hit);
--bar-caution: var(--status-caution);
--bar-miss:    var(--status-miss);
```

### css/tracker.css

**Pace badges:** Replace all five `.pace-badge--ahead/on-track/behind/early/started`
blocks (and their `[data-theme="side-b"]` text-color overrides) with token-based
versions using `--pace-*` tokens. Remove the five `[data-theme="side-b"]` overrides
entirely -- tokens auto-swap.

**FW badges:** Replace `.fw-badge--hit/close/miss` hard-coded colors with
`--status-hit/caution/miss` tokens.

**FW dots:** Replace `.fw-dot--hit/close/miss` with same tokens.

**Summary week chips:** Replace `.summary-week-chip--hit/miss` with same tokens.

**Status pills:** Replace `.summary-habit-streak` hard-coded orange (#fb923c / #ea580c)
and its `[data-theme="light"]` override. The pill should use different classes for
"to go" vs "target met" states:
- `.summary-habit-streak--togo`: uses --status-caution tokens
- `.summary-habit-streak--met`: uses --status-hit tokens
Remove the `[data-theme="light"]` override block.

**Over-target glow:** Replace `.summary-habit-pct--over` hard-coded #86efac / #15803d
with `--status-hit`. Remove the `[data-theme="light"]` override. Drop the text-shadow
glow (it doesn't fit the Mixtape aesthetic).

**Done banner pill:** Replace `.status-banner--done .status-banner__pill` background
`var(--color-success, #22C55E)` with `var(--status-hit)`.

**FW empty overlay:** Replace `.fw-empty-overlay` background `rgba(30, 35, 60, 0.75)`
with `var(--fw-overlay)`. Replace the `[data-theme="light"]` override with nothing
(the token auto-swaps). Use `var(--ink)` and `var(--ink-soft)` for text colors in the
overlay (they auto-swap too).

**Legacy theme selectors:** Find and remove ALL `[data-theme="light"]` selectors
in tracker.css. These reference the old theme name. The affected blocks are:
- `.summary-habit-streak` light override
- `.summary-habit-pct--over` light override
- `.fw-empty-overlay` light override
- `.day-header-sunday` light overrides
- `.day-header-future` light overrides
- `.day-header.week-start/mid/end` light overrides
- `.day-cell.future` light override
- `.summary-stat__help-btn` light override
- `.summary-stat__tooltip` light override
- `.top-insight` light override
- `.habit-insight` light override
- `.tgl-sunday` light override
- `.tgl-week` light override

For each, check if the rule is still needed. If the base rule already works on Side A
(because our token defaults are Side A), the `[data-theme="light"]` block is dead code.
If it provides a genuinely different value for Side A, convert it to `[data-theme="side-a"]`
or just make it the base rule (since `:root` is Side A by default).

**Activity cadence tag:** The `.activity-cad-tag` uses hard-coded indigo values
(rgba(99, 102, 241, ...)) with a `[data-theme="light"]` override. Migrate to
`--blue` tokens. The text color should be `--blue`, background is `--blue` at low
opacity, border is `--blue` at medium opacity.

### js/tracker-summary.js

**Remove inline barColor logic.** The `barColor` variable currently computes a hex
value and applies it via inline `style="background:...";style="color:..."`. Replace
this with CSS class assignment:

- If displayRate >= 100: add class `summary-habit-fill--hit`
- If displayRate >= 70: add class `summary-habit-fill--caution`
- Else: add class `summary-habit-fill--miss`

Same for the `pctClass` / `pctStyle` -- remove the inline style approach. Use:
- `summary-habit-pct--hit`
- `summary-habit-pct--caution`
- `summary-habit-pct--miss`

(The `--over` class stays for the over-target case.)

**Status pill class assignment.** The `statusPill` HTML currently uses the same
class for both "to go" and "target met". Split into:
- `summary-habit-streak--togo` for the "X to go" pill
- `summary-habit-streak--met` for the target-met pill

**Remove --color-success fallback.** The template string references
`var(--color-success, #22C55E)` in two places. Remove both; the CSS now handles
colors via class-based tokens.

---

## 5. What NOT to do

- Do not change the habit activity colors (the per-activity dot colors from
  getActivityColor()). Those are user-decorative, not status-semantic.
- Do not change the status banner border/background colors (orange for pending,
  green for done). Those are already using rgba values that work on both themes.
  Only the "All done!" pill background needs to change.
- Do not introduce new hex values. Every token must derive from existing palette
  colors. The one exception is --status-caution on Side A (#B8860B), which is a
  darkened gold -- still derived from the gold family.
- Do not change the full-week calendar's indigo week-highlight ring
  (`.fw-week--full` outline). That's a separate color system for week boundaries,
  not status tiers. It can be migrated in a future pass if needed.

---

## 6. Verify

- Side A: all pace badges readable on cream background, no Tailwind colors visible
- Side B: all pace badges auto-swap via tokens, no one-off `[data-theme]` overrides
- Progress bar fills use CSS classes, not inline styles
- Progress pct text colors match bar fills
- "X to go" pill uses gold/caution styling
- "Target met" pill uses green/hit styling
- Over-target text uses --status-hit color, no glow
- "All done!" banner pill uses --status-hit (dark forest green on A, teal on B)
- FW badges (hit/close/miss) use --status-hit/caution/miss tokens
- FW empty overlay: cream frosted glass on Side A, maroon frosted glass on Side B
- Overlay text is readable on both themes (uses --ink / --ink-soft)
- No `[data-theme="light"]` selectors remain in tracker.css
- No `var(--color-success)` references remain anywhere
- No inline `style="background:..."` or `style="color:..."` for status colors in
  tracker-summary.js (check the rendered DOM, not just the source)
- Activity cad tag uses --blue tokens instead of hard-coded indigo

---

## 7. Migration order

Recommended sequence to minimize breakage during development:

1. **Add tokens to variables.css** (both theme blocks). Nothing breaks.
2. **Add new CSS classes to tracker.css** (fill--hit/caution/miss, pct--hit/caution/miss,
   streak--togo/met). Old classes still work.
3. **Update tracker-summary.js** to use new classes instead of inline styles.
4. **Remove old hard-coded CSS** (pace badge hex values, fw-badge hex values, etc.).
5. **Remove `[data-theme="light"]` selectors.**
6. **Remove `[data-theme="side-b"]` pace badge text-color overrides** (tokens handle it).
7. **Fix fw-empty-overlay** backdrop and text colors.
8. **Fix activity cad tag** to use --blue tokens.
9. **Test both themes, both viewports.**

---

*PO09. Built by Jen & Cii* 🪨
