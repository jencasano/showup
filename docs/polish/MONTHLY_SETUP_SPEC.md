# Monthly Setup Polish Spec

Scoped polish pass for the monthly setup modal (`js/month-setup.js`). Focuses on the Step 1 decoration screen and brings it into Mixtape alignment without touching the activity/cadence logic in Step 2.

This spec is a **scoped amendment** to `MIXTAPE_SPEC.md`. The Mixtape spec remains the top-level rulebook. Anything not addressed here defers to it.

---

## 1. Context

The monthly setup modal is the first premium surface a new user sees. It sets the tone for the whole product. Today it runs on a pre-Mixtape palette (coral + generic yellow + cognac + blue + teal + green + mauve, 8 swatches) with generic markers (5-point star, no Mixtape motif), and a "Next →" button that uses arrow-as-punctuation in a way that reads close to an em-dash cadence.

Three issues worth fixing in this pass:

1. **Badge palette.** The Side A palette leads with Mixtape red (`#C3342B`) but slot 2 is coral (`#F07A5E`), which is Side B's hero red. Two reds in the same row weakens the hero. Side B has no dedicated palette and inherits Side A's.
2. **Markers.** Generic shapes that do not incorporate any Mixtape motif vocabulary. The 5-point star is not our star.
3. **Next button copy.** "Next →" reads as dash-cadence. Does not match the Mixtape voice rule against em-dashes (§3).

Stickers are intentionally **not** in scope here. They need a dedicated repaint pass and are covered in a future `STICKER_REPAINT_SPEC.md` (see Section 6).

---

## 2. Badge palette

### 2.1 Current state

`js/month-setup.js` defines:

```
const COLORS = ["#C3342B", "#F07A5E", "#E8B33A", "#A65E3A", "#4F6C8E", "#5EAAA8", "#3E5C3A", "#8A6585"];
```

Eight hex values, hardcoded, identical for both themes. Slot 1 is Mixtape red, slot 2 is coral (which is Side B's hero red).

### 2.2 Fix: per-theme palettes, coral dropped

Replace the single `COLORS` constant with two palettes, one per theme. At runtime, the modal reads the active theme from `document.documentElement.getAttribute("data-theme")` and picks the matching palette.

**Side A palette (7 swatches):**

```
#C3342B  Mixtape red (hero)
#E8B33A  yellow
#A65E3A  cognac
#4F6C8E  blue
#5EAAA8  teal
#3E5C3A  green
#8A6585  mauve
```

**Side B palette (7 swatches):**

```
#F07A5E  salmon (hero)
#E8B33A  yellow
#A65E3A  cognac
#5EAAA8  teal
#3E5C3A  green
#8A6585  mauve
#D2937A  dusty rose (warm-dark-friendly)
```

Reasoning:
- Each theme leads with its hero red in slot 1.
- Each theme excludes the other theme's hero red to keep the hero decisive.
- Side B drops `#4F6C8E` (Side A blue reads cool/muddy on maroon) and substitutes `#D2937A` (a warm rose that reads well on Side B's warm-dark surfaces).
- Yellow, cognac, teal, green, mauve are the shared "supporting" colors that work on both sides.

### 2.3 Storage and migration

The decoration color is already stored as a hex string on the log entry (`entryData.decoration.color`). No schema change needed. Users who previously selected `#F07A5E` on Side A will keep their saved color (no forced migration); they just will not see that swatch as an option when they set up their next month on Side A.

If a user is on Side B and has a saved color that does not appear in the Side B palette (e.g. `#C3342B` from when they set up on Side A), the modal should still render their selection as-selected even though it is not in the picker row. Code-level: the render function should treat the stored color as "the user's current pick" and highlight it only if it appears in the active palette; otherwise, no swatch is highlighted but the preview still uses the stored color. VSCii: handle this gracefully.

---

## 3. Marker reorder + Mixtape sparkle

### 3.1 Current state

`js/month-setup.js` defines:

```
const MARKERS = [
  { value: "square",   symbol: "■" },
  { value: "circle",   symbol: "●" },
  { value: "star",     symbol: "★" },
  { value: "heart",    symbol: "♥" },
  { value: "check",    symbol: "✓" },
  { value: "x",        symbol: "✗" },
  { value: "scribble", symbol: "〰" }
];
```

Seven markers, rendered as Unicode symbols in the picker. The `star` uses the generic 5-point Unicode star (`★`), which is not our star.

### 3.2 Fix: reorder and swap the star

**New marker order:**

```
square, sparkle, circle, heart, check, x, squiggle
```

- **Square moves to slot 1.** The red filled square is the visual echo of the wordmark's period. It is the most Mixtape-specific shape in the set and deserves first position.
- **Sparkle moves to slot 2.** Replaces the existing `star` entry. The value stays `"star"` on the user doc so existing saved selections continue to resolve (back-compat). The rendered shape is the Mixtape 4-point sparkle, not the Unicode 5-point star.
- **Circle, heart, check, x** keep their relative order. These are universal shapes.
- **Squiggle stays last.** Value stays `scribble` on the user doc for back-compat (the name change from scribble to squiggle is not worth the data migration).

### 3.3 The sparkle path

The Mixtape sparkle already exists in `index.html`, in the sidebar motif:

```
<path class="sb-motif-star" d="M30 6 l3 -4 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-3 -4 l-4 -1.5 z"/>
```

This is the canonical shape. For the marker, the same shape centered in a 24x24 viewBox:

```
<path d="M12 3 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" fill="currentColor"/>
```

### 3.4 Rendering: move from Unicode to SVG

The current marker picker renders Unicode glyphs (`★`, `■`, etc.) inside divs. This works but is inconsistent with the rest of the app (which uses real SVG icons via `js/icons.js`).

VSCii: replace the Unicode symbols with inline SVG paths for all seven markers. Pattern mirrors how `icons.js` renders icons, but inline rather than from `/assets/icons/*.svg`, because these are picker-internal shapes that do not need to be used anywhere else.

Suggested marker SVG paths (all 24x24 viewBox, `fill="currentColor"` or `stroke="currentColor"` as appropriate):

- **square:** `<rect x="7" y="7" width="10" height="10" fill="currentColor"/>`
- **sparkle:** `<path d="M12 3 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" fill="currentColor"/>`
- **circle:** `<circle cx="12" cy="12" r="5" fill="currentColor"/>`
- **heart:** `<path d="M12 19s-7-4.5-7-9.5c0-2.5 2-4.5 4.5-4.5c1.5 0 2.5 0.8 2.5 2c0-1.2 1-2 2.5-2c2.5 0 4.5 2 4.5 4.5c0 5-7 9.5-7 9.5z" fill="currentColor"/>`
- **check:** `<path d="M5 12l5 5l9-10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
- **x:** `<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`
- **squiggle:** `<path d="M3 12c2 -3 4 -3 6 0s4 3 6 0s4 -3 6 0" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>`

All seven use `currentColor` so they inherit the `.ms-marker-option` text color from CSS. This also means the picker respects theme tokens automatically.

---

## 4. Next button copy

### 4.1 Current state

In `buildModalHTML()`:

```
<button id="ms-next-btn">Next →</button>
<button id="ms-save-btn" style="display:none;">Save & Start Tracking →</button>
```

The arrow glyph is fine; the problem is the space + arrow construction reads with em-dash cadence in the context of a product that bans em-dashes.

### 4.2 Fix

Change both labels to use comma + space + arrow:

```
Next, →
Save & Start Tracking, →
```

The comma anchors the arrow as a continuation marker rather than a dash substitute. Very small change, meaningful voice alignment.

This is a one-line-per-button text replacement. No other button handling changes.

---

## 5. Stickers (explicitly unchanged)

The sticker row in Step 1 currently shows 14 stickers loaded from `/assets/icons/*.svg`. These stickers were authored before the Mixtape redesign and use pre-Mixtape colors (`#F59E0B`, `#92400E`, `#6EA04B`, etc.). They do not harmonize with the Mixtape palette.

**This spec does not touch the sticker SVGs.** The sticker picker code path in `js/month-setup.js` and the sticker assets in `assets/icons/` remain unchanged. Stickers will continue to render as they do today until `STICKER_REPAINT_SPEC.md` ships.

This is a deliberate scope split. See Section 6.

---

## 6. Out of scope

Things intentionally parked:

- **Sticker repaint.** The 14 sticker SVGs (`sunflower2`, `muscle`, `star`, `run`, `brain`, `bacon`, `steak`, `butter`, `sprout`, `boom`, `headphones`, `dumbbell`, `flame`, `target`) need to be re-authored in the Mixtape palette. This is a dedicated artwork pass and will ship as `STICKER_REPAINT_SPEC.md`. Decision locked: each sticker gets 2-3 hand-picked colors from a fixed Mixtape sticker palette (red, yellow, cognac, green, blue/teal, mauve, ink, paper); stickers do not react to badge color (no `currentColor` gymnastics), they are authored objects that live inside the Mixtape palette.
- **Step 2 (Activities + Cadence).** Layout, copy, and cadence picker untouched. That is a separate polish task.
- **Sticker count.** Keeping at 14 for now. If the sticker repaint pass prunes the set to a tighter curated list, that happens there, not here.
- **Font color swatches.** The 4-color font-color swatch row (white, ink, paper-ish, dark maroon) is generated via `getFontColorSuggestions()` in `utils.js`. That function already returns theme-friendly values per badge color. No changes.
- **Preview badge styling.** The red pill preview badge uses existing tokens and will automatically follow the palette change. No additional work needed.
- **Step 2 save button copy.** "Save & Start Tracking →" gets the same comma fix as Next (see §4), but no other Step 2 changes.
- **Manage Activities modal.** Out of scope. Backlog item 3.

---

## 7. Implementation checklist for VSCii

When this spec is ready to ship, the complete set of changes is:

- **`js/month-setup.js`**
  - Replace the single `COLORS` array with two named palettes (e.g. `COLORS_SIDE_A` and `COLORS_SIDE_B`), each 7 hex values, per Section 2.2.
  - Add a helper that returns the active palette based on `document.documentElement.getAttribute("data-theme")`. Default to Side A if the attribute is missing.
  - Update the render path in `buildModalHTML()` so the swatch row iterates over the active palette instead of the static `COLORS` constant.
  - Update the `MARKERS` array to the new order: `square, star (sparkle), circle, heart, check, x, scribble (squiggle)`. Keep the `value` strings unchanged (`"star"`, `"scribble"`) for back-compat with stored user data. Replace the `symbol` field with a new `svg` field containing the inline SVG path for each marker, per Section 3.4.
  - Update the marker render path in `buildModalHTML()` to render inline SVG instead of Unicode symbols. The rendered SVG should inherit color via `currentColor`.
  - Change the Next button label from `Next →` to `Next, →`.
  - Change the Save button label from `Save & Start Tracking →` to `Save & Start Tracking, →`.
  - Handle the edge case where a user's saved badge color is not in the active palette (render it as the current pick without highlighting it in the picker row), per Section 2.3.
- **`css/modals.css`** (if needed)
  - If the marker picker CSS sizes/positions the rendered content assuming a Unicode character, adjust for inline SVG (width/height on the SVG, centering). The `.ms-marker-option` selector already has `display: flex; align-items: center; justify-content: center;` so the SVG should center automatically at a reasonable size (22x22 inside a 44x44 cell matches the sticker picker).
- No HTML changes.
- No changes to `assets/icons/` (stickers stay as-is).
- Commit message: `feat(polish): monthly setup palette + markers`

No new files. No Firestore schema changes. Single self-contained commit.

---

## 8. Voice review checklist

Before shipping, confirm against the Mixtape copy review checklist (`MIXTAPE_SPEC.md` §2):

- [ ] Would a friend say this? (Next, → yes. Save & Start Tracking, → yes.)
- [ ] Any em-dashes? (no)
- [ ] Any exclamation points? (no, even the existing "Please add at least one activity!" is not touched here, but worth flagging for a future pass)
- [ ] Any "the user" language? (no)
- [ ] Any AI-ish phrasing? (no)

---

## 9. Visual review checklist

Before shipping, open `mockups/monthly-setup-polish.html` and confirm:

- [ ] Side A palette shows 7 swatches, red is first, no coral.
- [ ] Side B palette shows 7 swatches, salmon is first, no Side A red.
- [ ] Marker row: square, sparkle, circle, heart, check, x, squiggle (in that order).
- [ ] Sparkle renders as the 4-point Mixtape motif (two long points vertical, two short points horizontal), not the 5-point Unicode star.
- [ ] Square reads as a solid red block when selected in the badge color (echoes the wordmark period).
- [ ] Preview badge updates color when a swatch is clicked.
- [ ] Modal looks correct on both Side A and Side B.

---

Built by Jen and Cii 🪨
