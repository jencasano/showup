# Diary Polish Spec

Scoped tokenization pass for the diary surface (`css/diary-book.css` and adjacent diary-related rules in `css/tracker.css`). Replaces pre-Mixtape hardcoded color values with Mixtape tokens so the diary respects the active theme while protecting its intimate paper world.

This spec is a **scoped amendment** to `MIXTAPE_SPEC.md`. The Mixtape spec remains the top-level rulebook. Anything not addressed here defers to it.

---

## 1. Context

The diary is the emotional peak of showup. (per MIXTAPE_SPEC §1, Brand Pillar 2). It has its own aesthetic world: paper stays paper, ink stays ink, even on Side B. The user's notebook cover (red, cream, or navy) is the diary's hero element, and the inside pages should feel like a ruled notebook regardless of which theme the app is on.

The current diary CSS was authored before the Mixtape tokens existed. Several elements still reference old coral hex values (`#D8584E`, `rgba(216, 88, 78, ...)`, `#C4473D`) that predate the Side A red (`#C3342B`). A few amber highlights use `#D97706` / `#C8972A` rather than the Mixtape yellow (`#E8B33A`).

None of this is broken, but none of it is Mixtape-correct either. This spec cleans it up.

**Three things this pass does:**

1. Replace coral-red hardcodes with Mixtape red token (`var(--red)`) where the element should track the app theme.
2. Replace amber-orange hardcodes with Mixtape yellow token (`var(--yellow)`) where the amber was meant to signal a diary-day indicator.
3. Preserve the paper world. Page backgrounds, rule lines, polaroid paper stay as-is. The diary is its own aesthetic register.

**One thing this pass verifies:**

The desktop notebook widget on My log reflects the user's selected diary cover (`users/{uid}.diaryTheme`). The handoff flagged this needs verification.

---

## 2. Coral-to-red replacements

### 2.1 The target token

All coral-ish hardcodes in diary surfaces should swap to `var(--red)`.

Why this works per-theme:
- On Side A, `var(--red)` resolves to `#C3342B` (Mixtape red).
- On Side B, `var(--red)` resolves to `#F07A5E` (Mixtape salmon).

Both read correctly on the diary's paper surface. Both match the active theme's hero red. No further per-theme overrides needed.

### 2.2 In `css/diary-book.css`

The following selectors currently use hardcoded coral values. Each should switch to `var(--red)`, preserving the existing alpha value where transparency was intentional.

| Selector | Current value | Replace with |
|---|---|---|
| `.diary-modal-left::before` (background) | `rgba(216, 88, 78, .25)` | `color-mix` of `var(--red)` at 25%, or document-level RGB equivalent. See §2.3 for technique. |
| `.diary-modal-right::before` (background) | `rgba(216, 88, 78, .22)` | Same technique, 22%. |
| `.diary-modal-cal-day.active` (background) | `rgba(216, 88, 78, .12)` | Same technique, 12%. |
| `.diary-modal-page-nav::before` (background) | `#D8584E` | `var(--red)` |
| `.diary-modal-pf-btn:hover:not(:disabled)` (color) | `#C4473D` | `var(--red-hover)` |
| `.diary-modal-edit-btn:hover` (background) | `#C4473D` | `var(--red-hover)` |
| `.diary-modal-write-btn:hover` (background) | `#C4473D` | `var(--red-hover)` |
| `.diary-mini-page::before` (background) | `rgba(216, 88, 78, .2)` | Same alpha technique, 20%. |
| `.mob-diary-cal-cell.active` (background) | `rgba(216, 88, 78, .12)` | Same alpha technique, 12%. |
| `.mob-diary-cal-cell.active .mob-diary-cal-dot` (background) | `rgba(216, 88, 78, 0.6)` | Same alpha technique, 60%. |

### 2.3 Technique for transparent red

`rgba(216, 88, 78, X)` cannot be expressed as `var(--red) with alpha X` in old CSS. Three options, ranked:

**Option A (preferred): `color-mix()`.** Modern CSS (Safari 16.2+, Chrome 111+, Firefox 113+, all current in 2026). Works with any custom property.

```css
background: color-mix(in srgb, var(--red) 12%, transparent);
```

This resolves to Mixtape red at 12% opacity on Side A, salmon at 12% opacity on Side B. Clean, readable, theme-aware.

**Option B: `--red-wash` already exists in `variables.css`.** Check if the existing `--red-wash` token fits these use cases. On Side A it is `#F5D9D5` (solid tinted paper). On Side B it is `rgba(240, 122, 94, 0.18)` (transparent salmon). These are different forms. Only usable where both need the same treatment, which they do not here.

**Option C: Introduce a new token.** Add `--red-alpha-12` etc. to `variables.css`. Too granular, scope creep.

**VSCii: use Option A (`color-mix`).** Every instance of `rgba(216, 88, 78, X)` becomes `color-mix(in srgb, var(--red) {X%}, transparent)` where X% is the original alpha expressed as a percentage (0.12 → 12%, 0.25 → 25%, etc.).

### 2.4 In `css/tracker.css`

Two diary-adjacent rules in tracker.css that also need the treatment:

| Selector | Current value | Replace with |
|---|---|---|
| `.fw-day:has(.fw-join-indicator)` (background) | `rgba(216, 88, 78, 0.15)` | `color-mix(in srgb, var(--red) 15%, transparent)` |
| `.fw-day:has(.fw-join-indicator)` (border-color) | `rgba(216, 88, 78, 0.5)` | `color-mix(in srgb, var(--red) 50%, transparent)` |
| `.fw-overlay-join-note` (background) | `rgba(216, 88, 78, 0.12)` | `color-mix(in srgb, var(--red) 12%, transparent)` |
| `.fw-overlay-join-note` (border-color) | `rgba(216, 88, 78, 0.3)` | `color-mix(in srgb, var(--red) 30%, transparent)` |

### 2.5 Tuesday italic number (and any date accents)

The handoff mentioned "Tuesday italic number" as one of the coral accents to swap. Scanning the diary CSS, the closest match is `.diary-modal-entry-date strong`, which currently reads `color: var(--color-primary)`. This already resolves to red on both sides via the legacy alias. No change needed, but worth verifying visually during review.

---

## 3. Amber-to-yellow replacements

### 3.1 The target token

All amber/orange hardcodes in diary "has entry" indicators should swap to `var(--yellow)`.

Why this works per-theme:
- On Side A, `var(--yellow)` resolves to `#E8B33A`.
- On Side B, `var(--yellow)` resolves to `#E8B33A` (same on both, shared supporting color).

The diary's "there is a diary entry on this day" signal is the yellow dot. Mixtape yellow is the correct color; the amber hardcodes were pre-Mixtape approximations.

### 3.2 Replacements

| File | Selector | Current value | Replace with |
|---|---|---|---|
| `diary-book.css` | `.diary-modal-cal-dot` (background) | `#D97706` | `var(--yellow)` |
| `diary-book.css` | `.mob-diary-cal-dot` (background) | `#D97706` | `var(--yellow)` |
| `diary-book.css` | `.mob-diary-pip.has-entry::after` (background) | `#C8972A` | `var(--yellow)` |

---

## 4. Paper surfaces stay paper

Deliberately **unchanged** in this pass:

- `.diary-modal-left` background: `#F2EDD8`
- `.diary-modal-right` background: `#FAF7ED`
- `.mob-diary-sheet` background: `#F5EDE0`
- All rule-line colors (`#C8BD9C`, `#D5C9A8`, `#E8DFC4`, etc.)
- Polaroid paper (`white`)
- Notebook spine and cover colors (driven by `diary-themes.js`, not CSS)

These are the diary's aesthetic identity. Paper is paper whether the app is on Side A or Side B. The intimacy of the diary depends on this consistency.

If a user is on Side B and opens the diary, they see light paper surfaces inside the modal. This is intentional, not a bug.

---

## 5. Chrome respects theme (verification pass)

These elements should already respect the active theme. Confirm during review:

- `.diary-pages-close-btn` — reads `var(--text-muted)`, `var(--border)`. ✓
- `.diary-modal-close` — reads `var(--color-primary)`. ✓
- `.diary-pages-head` — reads `var(--bg-surface)`, `var(--border)`. ✓
- `.diary-pages-back-btn` — reads `var(--color-primary)`. ✓
- Confirm dialogs (`.confirm-modal`, etc.) — read tokens. ✓

No code changes expected in this section. If anything is hardcoded here that was missed, VSCii flags it and we handle in a follow-up.

**Small chrome reminder:** the Close X button (top right of the diary modal), the page nav arrows (`‹ previous` / `next ›`), and the "blank page" hint copy all sit inside the diary's paper world but read from theme tokens for their ink color. This is correct behavior. They should look like pen marks on paper on Side A, and the same on Side B since paper stays paper.

---

## 6. Diary widget cover reflection (verification)

### 6.1 Context

The handoff flagged: **"Verify diary widget on mylog reflects user's selected cover."**

The diary cover choice lives at `users/{uid}.diaryTheme` (see ROCKSTACK firestore paths, and `js/diary-themes.js` for the three cover definitions: coral, cream, indigo).

The desktop notebook widget on the My log page should render with the user's selected cover applied. On click, the opened notebook modal should also match. Both on mobile and desktop.

### 6.2 What to verify

VSCii: scan `js/tracker-mylog.js` (and `js/tracker-diary.js` if it exists) for the code that renders the closed notebook widget on desktop. Confirm it:

1. Reads `users/{uid}.diaryTheme` from the user doc.
2. Applies the appropriate class (`.diary-theme-coral`, `.diary-theme-cream`, `.diary-theme-indigo`) or inline style overrides based on that value.
3. Falls back to the default theme (`DEFAULT_DIARY_THEME = "coral"` per `diary-themes.js`) if no theme is stored.
4. Same behavior on the mobile `.mob-diary-card`.

If any of those steps are missing or broken, flag them. Do not fix in this spec. Fixing is a separate small task if needed, because we do not want to accidentally touch diary widget rendering logic mid-tokenization pass.

### 6.3 "Coral" is a misnomer

Heads up: the theme key `coral` in `diary-themes.js` now defines a cover using `#C3342B` (Mixtape red). The label is historical. Renaming to `red` would be a data migration we do not want to chase right now. The label stays `coral` in code; users see the cover as red.

When `DIARY_COVER_SYSTEM_SPEC.md` is written (next polish item after this one), we can revisit naming. Not here.

---

## 7. Out of scope

Things intentionally parked:

- **Diary cover system redesign.** The three covers (coral/cream/indigo) keep their current definitions in this pass. Retuning to Mixtape palette and architecting for paid covers is covered in `DIARY_COVER_SYSTEM_SPEC.md` (next up).
- **Diary polaroid square in desktop modal.** Backlog item 7. Separate task.
- **Per-habit photo reel.** Diary Phase B. Backlog item 14.
- **Swipe between pages.** Diary Phase B.
- **Social diary pages for followers.** Diary Phase C.
- **Pages modal redesign** (the grid view showing all mini pages). Paper and rule lines stay as they are.
- **Manage Activities modal yellow highlights** (`.ma-name-was`, `.confirm-highlight`, etc.) — already using `var(--yellow)`. Not touching.

---

## 8. Implementation checklist for VSCii

When this spec is ready to ship, the complete set of changes is:

- **`css/diary-book.css`**
  - Replace every `rgba(216, 88, 78, X)` occurrence with `color-mix(in srgb, var(--red) Y%, transparent)` where Y is X×100 (e.g. 0.25 → 25%).
  - Replace `#D8584E` with `var(--red)`.
  - Replace `#C4473D` (every occurrence, across multiple hover rules) with `var(--red-hover)`.
  - Replace `#D97706` (both occurrences) with `var(--yellow)`.
  - Replace `#C8972A` in `.mob-diary-pip.has-entry::after` with `var(--yellow)`.
  - Do **not** touch paper background colors, rule-line colors, polaroid colors, or spine/ribbon gradient hexes (those are owned by `diary-themes.js`, not `diary-book.css`).
- **`css/tracker.css`**
  - Replace `rgba(216, 88, 78, X)` in `.fw-day:has(.fw-join-indicator)` and `.fw-overlay-join-note` with `color-mix(in srgb, var(--red) Y%, transparent)` per the same pattern.
- **Diary widget cover reflection verification**
  - Verify `js/tracker-mylog.js` (and/or `js/tracker-diary.js`) reads `users/{uid}.diaryTheme` and applies the correct class/style to the closed notebook widget on desktop.
  - Same verification for mobile `.mob-diary-card`.
  - If either is broken, flag it. Do not fix here.
- Commit message: `feat(polish): diary tokenization pass`

No new files. No JavaScript changes expected (unless verification §6.2 surfaces bugs). No Firestore schema changes. Single self-contained commit.

---

## 9. Voice review checklist

This is a CSS-only pass, so voice review is minimal. But confirm nothing changed in user-facing copy:

- [ ] No diary UI strings were edited.
- [ ] No button labels changed.
- [ ] No error messages changed.

---

## 10. Visual review checklist

Before shipping, open the diary on both Side A and Side B and confirm:

**Side A (light):**
- [ ] The red vertical margin rule on each page looks red, not coral.
- [ ] The active calendar date highlight is a Mixtape-red tinted square.
- [ ] Page-flip arrows are red and darken to `--red-hover` on hover.
- [ ] "Write something" button is red and darkens on hover.
- [ ] Calendar day dots (indicating a diary entry exists) are Mixtape yellow, not amber.
- [ ] Mobile diary pip "has entry" dot is Mixtape yellow.
- [ ] Paper backgrounds still look like warm cream paper.
- [ ] Polaroids still look like real polaroids on white card stock.

**Side B (dark):**
- [ ] The red vertical margin rule is salmon (Side B's red), not the Side A deep red.
- [ ] Active date highlight is salmon-tinted.
- [ ] Page-flip arrows are salmon.
- [ ] Paper backgrounds **still look like paper**, not dark maroon. This is intentional.
- [ ] The entire diary interior feels identical in structure to Side A, with only the red accents shifting hue.
- [ ] Close X button and other chrome elements feel readable against the paper.

**Cover reflection:**
- [ ] Change your diary cover via the swatch picker (coral / cream / indigo).
- [ ] Close and reload the app.
- [ ] The closed notebook widget on My log shows the selected cover.
- [ ] The mobile `.mob-diary-card` shows the same cover.
- [ ] Opening the notebook (modal) keeps the cover consistent.

---

Built by Jen and Cii 🪨
