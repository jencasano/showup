# Scrollbar Theming -- SCROLLBAR_SPEC.md (PO06)

> Source of truth for showup.'s scrollbar styling.
> Ensures the scrollbar thumb and track auto-swap per theme using existing design tokens.

---

## 1. Problem

`html { overflow-y: scroll; }` in base.css forces the scrollbar gutter to always render, but there is zero custom scrollbar styling. The browser default is a grey system scrollbar on every platform. On Side A (cream paper) this is tolerable. On Side B (dark maroon) it is a jarring grey bar that breaks the atmosphere.

---

## 2. Goal

Style the scrollbar so it blends into whichever theme is active. No new tokens needed -- everything resolves to existing palette variables that already have Side B overrides.

---

## 3. Token mapping

| Part | Token | Side A resolves to | Side B resolves to |
|------|-------|--------------------|--------------------|
| Track | `--paper-edge` | #DCCFA6 (warm tan) | #3A1D20 (deep maroon) |
| Thumb | `--ink-faint` | #9C8874 (muted brown) | #6E504B (muted rose) |
| Thumb hover | `--ink-soft` | #5A463A (dark brown) | #B18A84 (dusty pink) |

These are subtle, low-contrast pairings. The scrollbar should recede, not compete with content.

---

## 4. Implementation

All rules go in `css/base.css`, after the existing `html` block.

### WebKit / Blink (Chrome, Safari, Edge)

Three pseudo-elements:

- `::-webkit-scrollbar` -- set width to 8px. Thin enough to be discreet, wide enough to grab.
- `::-webkit-scrollbar-track` -- background from `--paper-edge`.
- `::-webkit-scrollbar-thumb` -- background from `--ink-faint`, border-radius fully rounded, with a transparent border inset trick (2px solid transparent + background-clip: padding-box) so the thumb floats inside the track with a small gap.
- `::-webkit-scrollbar-thumb:hover` -- background from `--ink-soft`.

### Firefox

Firefox uses `scrollbar-color` and `scrollbar-width` on the `html` element.

- `scrollbar-width: thin` (maps to roughly 8px, Firefox's compact mode).
- `scrollbar-color: var(--ink-faint) var(--paper-edge)` (thumb color first, track color second).

Firefox does not support hover states or border-radius on scrollbar thumbs via these properties. That is fine -- the base colors are enough.

### Placement

Add the WebKit rules and the Firefox properties together in base.css, right after the existing `html { }` block. Keep them in one cohesive section with a comment header.

---

## 5. What NOT to do

- Do not hide the scrollbar (`display: none`, `width: 0`). The scrollbar gutter is intentionally forced on via `overflow-y: scroll` to prevent layout shift.
- Do not add scrollbar styling to individual containers (modals, diary overlay, etc.) unless a future spec calls for it. This spec covers the page-level scrollbar only.
- Do not add `[data-theme="side-b"]` overrides. The tokens already auto-swap. That is the whole point.

---

## 6. Verify

- Side A: scrollbar track should be warm tan, thumb muted brown. Subtle but visible.
- Side B: scrollbar track should be deep maroon, thumb dusty rose. Blends into the leather feel.
- Toggle themes and confirm the scrollbar transitions smoothly (it may not animate, which is fine -- instant swap is acceptable).
- Firefox: confirm `scrollbar-width: thin` renders a narrower bar and colors match.

---

*PO06. Built by Jen & Cii* 🪨
