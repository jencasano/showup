# Toast System -- TOAST_SPEC.md (PO05)

> Source of truth for showup.'s toast hierarchy, tokens, copy conventions, and migration plan.
> Closes the --color-teal legacy alias. Establishes role-based toast backgrounds per theme.

Reference mockup: `mockups/toast-mockup.html`

---

## 1. Problem

The current toast system has three issues:

1. **No neutral type.** The default `showToast("message")` falls through to `toast-success`, which means every casual confirmation ("coming soon.", "signed out.") gets the success treatment. Most toasts are not celebrations.
2. **--color-teal is theme-unaware.** `.toast-success` uses `var(--color-teal)` (#80B9B9), a hard-coded legacy alias that does not participate in the Side A / Side B token system. It looks wrong on both themes.
3. **Missing hierarchy.** Three types exist (success, error, info) but there is no visual distinction between a quiet confirmation and a celebratory success. They need to be separate roles.

---

## 2. Toast roles

Four roles, ordered from quietest to loudest.

| Role | When to use | Frequency |
|------|-------------|-----------|
| **neutral** | Default. Quiet confirmations, status updates, informational stubs. "signed out.", "coming soon.", "copied." | Most toasts are this. |
| **info** | Contextual notices that need slight visual distinction from neutral. "link copied to clipboard.", "already following." | Occasional. |
| **success** | Genuine celebrations. Streak milestones, first entry saved, comeback after absence. | Rare. Reserve it. |
| **error** | Something failed. User needs to know. "couldn't save. try again?" | Hopefully rare. |

### The key distinction

**Neutral is the workhorse.** If you are not sure which type to use, use neutral. Success is reserved for moments that genuinely deserve celebration. Overusing success dilutes its meaning.

---

## 3. Design tokens

### Side A (cream paper)

| Role | Background | Text | Border | Extra |
|------|-----------|------|--------|-------|
| neutral | `--paper-deep` (#ECE1C6) | `--ink` (#2A1F1A) | 1px solid `--hairline` (#D4C3A1) | -- |
| info | `--paper-deep` (#ECE1C6) | `--ink` (#2A1F1A) | 1px solid `--hairline` + 3px left `--blue` (#4F6C8E) | Left border accent. Pill shape breaks to rounded-rect on left edge (10px left radius, 99px right). |
| success | `--green` (#3E5C3A) | `--paper` (#F4ECD8) | none | Deep forest green. Reads as confident and grounded. |
| error | `--red` (#C3342B) | white | none | Same as current. |

### Side B (warm leather)

| Role | Background | Text | Border | Extra |
|------|-----------|------|--------|-------|
| neutral | `--paper-deep` (#1D0E10) | `--ink` (#F0DCCF) | 1px solid `--hairline` (#4A2025) | -- |
| info | `--paper-deep` (#1D0E10) | `--ink` (#F0DCCF) | 1px solid `--hairline` + 3px left `--blue` (#5EAAA8) | `--blue` auto-remaps to teal on Side B. No extra logic needed. |
| success | `--green` (#5EAAA8) | `--paper` (#2A1518) | none | `--green` auto-remaps to teal on Side B. Dark text for contrast. |
| error | `--red` (#F07A5E) | `--paper` (#2A1518) | none | `--red` auto-remaps to salmon on Side B. Dark text for contrast. |

### Why green for success

Three candidates were evaluated in the mockup (red, green, yellow). Red conflicts with error (same color, different meaning). Yellow conflicts with a future warning tier. Green is distinct from every other role, works on both themes via the existing `--green` token (which already has a Side B override), and reads as "confirmed, solid" without shouting.

### New CSS tokens to add in variables.css

No new custom properties are needed. All four roles resolve to existing tokens:

- neutral: `--paper-deep`, `--ink`, `--hairline`
- info: same as neutral + `--blue` for the left accent
- success: `--green`, `--paper`
- error: `--red`, white (Side A) or `--paper` (Side B)

The role mapping lives entirely in `css/ui.css` class definitions.

---

## 4. CSS implementation

### Toast base (unchanged)

The base `.toast` class keeps its current structure: fixed bottom-center, pill shape, 600 weight, shadow, slide-up entrance animation. No changes needed.

### Role classes

Four classes replace the current three:

| Class | Replaces |
|-------|----------|
| `.toast-neutral` | new (becomes the default) |
| `.toast-info` | `.toast-info` (updated styling) |
| `.toast-success` | `.toast-success` (updated: reads from `--green` instead of `--color-teal`) |
| `.toast-error` | `.toast-error` (updated: Side B gets dark text instead of white) |

### Info pill shape

Info gets a left-border accent that breaks the pill symmetry. The left side uses a smaller border-radius (10px) while the right stays fully rounded (99px). This creates a subtle asymmetry: `border-radius: 10px 99px 99px 10px`. The left border is 3px solid using `--blue` (which auto-remaps to teal on Side B).

### Side B text color logic

On Side A, error text is white against `--red` (#C3342B). On Side B, `--red` is salmon (#F07A5E), which is lighter, so text should be dark (`--paper` = #2A1518) for contrast. Same logic applies to success on Side B.

Use a `[data-theme="side-b"]` selector override for `.toast-success` and `.toast-error` text color, or use a single approach where Side A uses `color: white` and Side B uses `color: var(--paper)`.

---

## 5. JS implementation

### showToast API

The `showToast` function in `js/ui.js` stays the same signature:

```
showToast(message, type = "neutral")
```

The only change: the **default type changes from "success" to "neutral"**.

This is the single most important change in this spec. Every call site that currently omits the second argument (e.g., `showToast("coming soon.")`) will automatically become neutral instead of success. Which is correct.

### Call site audit

Current calls and their correct new types:

| File | Current call | Current type | Correct type |
|------|-------------|--------------|--------------|
| app.js | `showToast("signed out.", "info")` | info | info (no change) |
| app.js | `showToast("coming soon.")` | success (default) | neutral (new default) |
| app.js | `showToast("coming soon.")` | success (default) | neutral (new default) |
| app.js | `showToast("Couldn't open diary. Try again.", "error")` | error | error (no change) |
| tracker-mylog.js | `showToast("couldn't load tracker. try again?", "error")` | error | error (no change) |
| tracker-mylog.js | `showToast("Couldn't save. Try again.", "error")` | error | error (no change) |

No existing call sites need their type argument changed. The default flip from "success" to "neutral" fixes the implicit ones automatically.

Future calls that should use success: streak milestone toasts, first-entry-ever toasts, comeback toasts. These do not exist yet (backlog item 12: milestone cards).

---

## 6. Copy conventions

### Casing

Toast copy follows the showup. voice rules from MIXTAPE_SPEC.md Section 2:

- Intentionally lowercase for intimacy: "saved.", "signed out.", "coming soon."
- Sentence case when formality serves clarity or when a proper noun is involved.
- Period at the end. Always. The period is the brand punctuation.

### Length

Toasts are one line. If you need more than ~40 characters, reconsider whether a toast is the right surface. Use a modal or inline message instead.

### Tone by role

| Role | Tone | Examples |
|------|------|---------|
| neutral | Quiet, factual. | "saved.", "signed out.", "copied." |
| info | Slightly more context. | "coming soon.", "already following.", "link copied to clipboard." |
| success | Warm, earned. Not shouty. | "streak saved.", "day 25. still here.", "welcome back." |
| error | Direct, kind. What failed + what to do. | "couldn't save. try again?", "photo didn't upload. try again?" |

### Forbidden in toasts

- Em-dashes (hard rule, always)
- Exclamation points (unless genuinely celebratory, and even then, probably not in a toast)
- "Oops!", "Whoops!", "Uh oh!" (startup cheerfulness)
- "Successfully" anything ("successfully saved" becomes "saved.")
- "Error:" prefix (the red color communicates error; don't label it too)

---

## 7. Migration checklist

### Step 1: Update css/ui.css

- Add `.toast-neutral` class (paper-deep bg, ink text, hairline border)
- Update `.toast-info` (add left-border accent using `--blue`, adjust border-radius)
- Update `.toast-success` (change from `var(--color-teal)` to `var(--green)`, paper text)
- Update `.toast-error` (add Side B text color override)
- Add `[data-theme="side-b"]` overrides for success and error text colors

### Step 2: Update js/ui.js

- Change the default type parameter from `"success"` to `"neutral"`

### Step 3: Retire --color-teal in css/variables.css

- Remove the `--color-teal: #80B9B9;` line from the `:root` / Side A block
- This alias has no remaining consumers after Step 1

### Step 4: Verify

- Test all four toast types on Side A
- Test all four toast types on Side B
- Confirm "coming soon." toasts render as neutral (not green)
- Confirm "signed out." renders as info
- Confirm error toasts have readable text on both themes
- Confirm no remaining references to `--color-teal` in the codebase

---

## 8. Future considerations

### Warning tier

A fifth role (warning / caution) may be needed for destructive confirmations ("unfollow? sure?") or rate-limit notices. Yellow (`--yellow`) is the natural candidate. Not needed now; do not pre-build it.

### Toast positioning

Currently bottom-center on all viewports. MIXTAPE_SPEC.md Section 6 mentions "bottom-right on desktop" as a future possibility. Not changing now; revisit when the desktop layout has more right-side content that toasts might overlap.

### Toast duration

Currently 3s for all types. Consider extending error toasts to 4-5s since they carry actionable information. Not changing now.

### Dismiss on tap

Toasts are not currently dismissible by tap. Consider adding tap-to-dismiss for all types. Not changing now.

---

*PO05. Built by Jen & Cii* 🪨
