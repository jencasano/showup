# Diary Cover System Spec · PO04

> Ship code: **PO04**
> Scope: Three retuned diary covers (Bold, Quiet, Moody), universal dotted paper, popover-style cover picker, entitlements architecture for future paid covers, setup flow restructure with the handoff moment.
> References: `docs/MIXTAPE_SPEC.md`, `docs/polish/DIARY_POLISH_SPEC.md` (PO03), `mockups/diary-cover-mockup-v2.html`.

---

## Overview

PO04 is the largest polish round shipped to date. It redesigns three things at once because they depend on each other:

1. **The three default diary covers** get retuned from their pre-Mixtape treatments into three emotional registers: Bold (red leather), Quiet (cream linen), Moody (navy with brass). Same three slots, different materials.
2. **The diary paper** upgrades from lined to dotted on all surfaces (main modal left and right pages, mobile sheet body, Pages view mini-pages). Ryder Carroll bullet journal reference. Applies to all covers, not per-cover.
3. **The cover picker UI** becomes a compact popover of mini cover thumbnails instead of a row of colored dots. Scales to N covers, supports locked/paid cover overlays for when Shop ships later.
4. **A new setup step** lands in `setup.html` so every user picks their diary cover at signup instead of getting the system default by accident.
5. **The setup-to-monthly-setup handoff** gets a proper separator moment. The two flows stop feeling like one long form.
6. **An entitlements architecture** (`entitlements/{uid}` Firestore doc) gets introduced even though no paid covers ship in this round. The data shape is ready so Phase 4 Shop doesn't require a rewrite.

Nothing structural about the open modal changes. Calendar still on the left, Calendar/Pages toggle still there, activity chips still there with their existing pill-with-checkmark treatment, polaroid with amber tape, handwritten Caveat note, page nav at the bottom with red pip separator (polished in PO03). Only the paper surface and the cover system change.

---

## 1. The three retuned covers

Each cover is a complete notebook object with a consistent 15-field schema. The retuning keeps the schema intact and rewrites the values for each cover's material identity.

### 1.1 Bold · Red leather

| Field | Value |
|---|---|
| `coverGradient` | `linear-gradient(160deg, #C3342B 0%, #B22D25 45%, #9A241C 100%)` |
| `spineBg` | `linear-gradient(90deg, #6B1810, #8B2218 60%, #A83428)` |
| `spineRightBorder` | `rgba(0,0,0,0.2)` |
| `bookBorder` | `#8B2218` |
| `cornerColor` | `linear-gradient(135deg, #E8C97A, #F8D98A)` (gold foil) |
| `ribbonBg` | `linear-gradient(180deg, #E8C97A, #C9A855)` (gold ribbon) |
| `holeBg` | `radial-gradient(circle at 35% 35%, #6B1810, #4A0C08)` |
| `gutterBg` | `linear-gradient(90deg, rgba(0,0,0,0.22), transparent)` |
| `titleColor` | `white` (with `text-shadow: 0 2px 12px rgba(0,0,0,0.35)`) |
| `monthColor` | `rgba(255,255,255,0.5)` |
| `ruleColor` | `linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)` |
| `statColor` | `white` |
| `statLabelColor` | `rgba(255,255,255,0.45)` |
| `hintColor` | `rgba(255,255,255,0.38)` |
| `taglineColor` | `rgba(255,255,255,0.35)` |
| `shadowColor` | `rgba(139,50,40,0.5)` (unchanged from current `coral`) |

**Character:** The Mixtape red leather notebook. Gold corners, gold ribbon, confident. Not a journal you hide.

### 1.2 Quiet · Cream linen

| Field | Value |
|---|---|
| `coverGradient` | `linear-gradient(160deg, #F4ECD8 0%, #ECE1C6 45%, #DCCFA6 100%)` |
| `spineBg` | `linear-gradient(90deg, #C9B890, #D4C3A1 60%, #E0D3B5)` |
| `spineRightBorder` | `rgba(0,0,0,0.08)` |
| `bookBorder` | `#C9B890` |
| `cornerColor` | `linear-gradient(135deg, #C3342B, #D85F54)` (Mixtape red) |
| `ribbonBg` | `linear-gradient(180deg, #C3342B, #A62822)` (red ribbon) |
| `holeBg` | `radial-gradient(circle at 35% 35%, #C9B890, #B09D75)` |
| `gutterBg` | `linear-gradient(90deg, rgba(0,0,0,0.07), transparent)` |
| `titleColor` | `#2A1F1A` (Mixtape ink) |
| `monthColor` | `rgba(42,31,26,0.4)` |
| `ruleColor` | `linear-gradient(90deg, transparent, rgba(195,52,43,0.3), transparent)` |
| `statColor` | `#2A1F1A` |
| `statLabelColor` | `rgba(42,31,26,0.4)` |
| `hintColor` | `rgba(42,31,26,0.35)` |
| `taglineColor` | `rgba(42,31,26,0.28)` |
| `shadowColor` | `rgba(0,0,0,0.2)` (unchanged from current `cream`) |

**Character:** Linen-bound. Paper-forward. The cover almost disappears into the paper it protects. Red accents on cream, which is the Mixtape signature combination played down.

### 1.3 Moody · Navy and brass

| Field | Value |
|---|---|
| `coverGradient` | `linear-gradient(160deg, #2D3354 0%, #1F2442 45%, #161A34 100%)` |
| `spineBg` | `linear-gradient(90deg, #12162E, #1A1F38 60%, #252A48)` |
| `spineRightBorder` | `rgba(0,0,0,0.22)` |
| `bookBorder` | `#1A1F38` |
| `cornerColor` | `linear-gradient(135deg, #C8972A, #E8C050)` (brass) |
| `ribbonBg` | `linear-gradient(180deg, #C8972A, #9A7020)` (brass ribbon) |
| `holeBg` | `radial-gradient(circle at 35% 35%, #1A1F38, #0A0E22)` |
| `gutterBg` | `linear-gradient(90deg, rgba(0,0,0,0.18), transparent)` |
| `titleColor` | `#F0DCCF` (Mixtape cream text, with `text-shadow: 0 2px 12px rgba(0,0,0,0.45)`) |
| `monthColor` | `rgba(240,220,207,0.42)` |
| `ruleColor` | `linear-gradient(90deg, transparent, rgba(200,151,42,0.42), transparent)` |
| `statColor` | `#F0DCCF` |
| `statLabelColor` | `rgba(240,220,207,0.4)` |
| `hintColor` | `rgba(240,220,207,0.32)` |
| `taglineColor` | `rgba(240,220,207,0.3)` |
| `shadowColor` | `rgba(0,0,0,0.45)` (unchanged from current `indigo`) |

**Character:** Midnight pocket journal. Brass corners, brass ribbon, deep navy cover that keeps its secrets. For users whose diary feels private by nature.

### 1.4 Paper stays paper

Critical principle from PO03 that carries forward: **the cover's material identity does not change with the app theme.** A red leather notebook stays red leather on Side A and Side B. Only the frame around it shifts. This keeps the emotional integrity of each cover intact across themes.

---

## 2. Cover schema extensions

The existing `js/diary-themes.js` exports a flat object per cover. PO04 extends the schema with metadata that the future Shop needs.

### 2.1 New fields

```js
export const DIARY_COVERS = {
  bold: {
    // NEW metadata fields
    id: "bold",
    displayName: "Bold",
    materialLabel: "Red leather",
    isPaid: false,
    price: null,

    // EXISTING visual fields (retuned, see Section 1)
    coverGradient: "...",
    spineBg: "...",
    // ...all 15 fields
  },
  quiet: { /* ... */ },
  moody: { /* ... */ },
};

export const DEFAULT_DIARY_COVER = "bold";
```

### 2.2 Key renames

| Old name | New name | Reason |
|---|---|---|
| `DIARY_THEMES` (export) | `DIARY_COVERS` | The word "theme" now refers to app themes (Side A, Side B). These are covers. |
| `DEFAULT_DIARY_THEME` | `DEFAULT_DIARY_COVER` | Same reason. |
| `"coral"` key | `"bold"` | Matches the new emotional register naming. |
| `"cream"` key | `"quiet"` | Same. |
| `"indigo"` key | `"moody"` | Same. |

### 2.3 Migration shim (one-off script)

Existing users have `users/{uid}.diaryTheme = "coral" | "cream" | "indigo"`. A one-time migration script maps old keys to new keys:

```
coral  -> bold
cream  -> quiet
indigo -> moody
```

Also renames the user doc field: `diaryTheme` -> `diaryCover`.

The script runs once from `scripts/migrate-diary-covers.mjs` (VSCii will author this). Idempotent: if the field is already `diaryCover`, the script skips the user. Logs count migrated, count skipped.

### 2.4 Backward compatibility at read time

During and after migration, the read path in `js/diary.js` tolerates both old and new shapes:

```
getDiaryCover(userDoc) {
  return userDoc.diaryCover
      || mapLegacyKey(userDoc.diaryTheme)
      || DEFAULT_DIARY_COVER;
}
```

`mapLegacyKey` translates `coral` -> `bold`, `cream` -> `quiet`, `indigo` -> `moody`. After the migration completes and we verify zero users on legacy keys, `mapLegacyKey` can be removed in a later polish round.

---

## 3. Entitlements architecture

### 3.1 Why a separate doc

Paid covers will eventually come through Stripe or Apple IAP, validated by a Cloud Function, and written to an entitlements doc the client cannot forge. User docs should stay client-writable for user preferences. Entitlements should be server-writable only. That separation is easier to set up now than retrofit after Shop ships.

### 3.2 Schema

```
entitlements/{uid}
  diaryCovers: ["bold", "quiet", "moody"]
  appThemes: ["side-a", "side-b"]
  stickerPacks: []
  // ...future entitlement arrays
```

### 3.3 Seed rules

**On signup:** when a new user is created, Cloud Function (or the existing signup flow, whichever ships first) writes the initial entitlements doc with all three default covers plus both default themes.

**Backfill for existing users:** one-off migration script `scripts/backfill-entitlements.mjs` creates `entitlements/{uid}` for every existing user with the same three defaults. Idempotent: skips users who already have the doc.

### 3.4 Firestore rules

```
match /entitlements/{uid} {
  allow read: if request.auth.uid == uid;
  allow write: if false;  // server-only writes via Cloud Functions
}
```

Client cannot add covers to its own entitlements list. The Shop purchase flow (Phase 4) will trigger a Cloud Function that validates the payment and updates the doc.

### 3.5 Client reads

```
async function getOwnedCovers(uid) {
  const snap = await getDoc(doc(db, "entitlements", uid));
  if (!snap.exists()) return ["bold", "quiet", "moody"];  // fallback
  return snap.data().diaryCovers || ["bold", "quiet", "moody"];
}
```

The picker UI filters `DIARY_COVERS` against this array to show owned covers first, then locked covers with lock overlay.

---

## 4. Per-month cover override

### 4.1 The pattern

Default cover lives at `users/{uid}.diaryCover`. Optional per-month override lives at `logs/{yearMonth}/entries/{uid}.diaryCover`. If the override is null or missing, fall back to the default.

### 4.2 Read path

```
function getActiveCover(userDoc, monthLog) {
  return monthLog?.diaryCover || userDoc?.diaryCover || DEFAULT_DIARY_COVER;
}
```

### 4.3 Why this exists

Some months feel different. December wants Bold. February wants Moody. Letting users switch per month without committing permanently respects that. They picked their default once at setup; they can explore on a per-month basis without losing their long-term pick.

### 4.4 UI indication

When a user is viewing a month whose cover differs from their default, the picker popover shows the override state subtly (e.g. the active swatch has the full red outline, and a tiny "just for April" label underneath). Not shouted, just noted.

---

## 5. Dotted paper

### 5.1 The upgrade

Every diary paper surface moves from ruled horizontal lines to a dotted grid. This applies universally across all three covers, not per-cover. The per-cover paper-style choice is deferred to Phase B.

### 5.2 Affected surfaces

| Surface | Grid spec |
|---|---|
| Desktop modal left page (`.diary-modal-left`) | 18px grid, 0.9px dots, `#C8BD9C`, offset 8px 8px |
| Desktop modal right page (`.diary-modal-right`) | 18px grid, 0.9px dots, `#D5C9A8`, offset 8px 8px |
| Mobile sheet body (`.mob-nb-body`) | 18px grid, 0.8px dots, `#C8BD9C`, offset 8px 8px |
| Pages view mini-pages (`.diary-mini-page`) | 10px grid, 0.6px dots, `#D5C9A8`, offset 5px 5px |

### 5.3 Why 10px on mini pages

The main modal has roomy 18px dots because the user writes on that paper. Mini pages are previews. At 18px on a small card, fewer than ten dots show and the card reads as sparse polka dots. At 10px, the dots become dense notebook texture that reads as paper at a glance.

### 5.4 Paper colors stay

From PO03: `.diary-modal-left` stays `#F2EDD8`, `.diary-modal-right` stays `#FAF7ED`, `.mob-nb-body` stays `#F5EDE0`, mini-pages stay `#FAF7ED`. The dotted overlay goes on top of these existing paper colors.

### 5.5 Red margin rule stays

Every page keeps its left vertical margin rule at the existing pixel offsets. `color-mix(in srgb, var(--red) 22-25%, transparent)`. Unchanged from PO03.

### 5.6 Implementation hint

Use `background-image: radial-gradient(circle, DOT_COLOR DOT_SIZE, transparent DOT_SIZE_PLUS_EPSILON)` with `background-size: GRID GRID`. Replace the current `repeating-linear-gradient` lined-paper declarations.

---

## 6. Cover picker · Popover design

### 6.1 Replacement for the dot row

The current palette picker is a row of three colored circles (swatches). PO04 replaces it with a popover of mini cover thumbnails. Each mini cover shows the actual cover art at 70×90px, with the cover name in DM Mono below.

### 6.2 Popover anatomy

```
+-----------------------------------------+
|  [mini bold]  [mini quiet*]  [mini moody]  [mini locked]  |
|    Bold         Quiet          Moody        Velvet       |
+-----------------------------------------+
* = selected (red outline, 2px offset)
locked cover = full color with lock icon overlay
```

### 6.3 States

| State | Treatment |
|---|---|
| Default (owned, not selected) | Mini cover at full saturation, hover raises 2px |
| Selected (current default or current month override) | Red outline, 2px, 2px offset |
| Locked (paid, not owned) | Full cover art visible, 50% dark overlay, lock icon centered, name muted |
| Per-month override active | Same as selected, plus tiny "just for April" text caption on hover or click |

### 6.4 Layout scaling

- 3 covers: single row, fits easily
- 4-6 covers: single row with horizontal scroll or wrap
- 7+ covers: wraps to 2 rows, or horizontal scroll with pagination dots
- Shop-style gallery view (full screen) lives in Settings later, not in this popover

### 6.5 Where the picker lives

1. **Notebook widget** (`renderDiaryNotebook`, closed state). Existing palette button stays, popover renders on click. Updated UI.
2. **Open modal left page** (`openDiaryModal`). Current swatch row becomes the same compact popover, triggered by clicking a small cover icon where the swatches currently sit.
3. **Mobile sheet palette bar** (`openMobileDiarySheet`). Replace the dot row in the top palette section with a horizontal scroll of mini cover thumbnails.

### 6.6 Where the picker does NOT live (yet)

**Settings gallery** is deferred to Phase 3 Settings panel. When Settings ships, it gets a full-width gallery of owned + locked covers with larger previews, purchase CTAs on locked covers, and the ability to set the default. The popover stays as the "quick swap" surface even after Settings ships.

---

## 7. First-time setup restructure

### 7.1 Current state (pre-PO04)

`setup.html` has one step: display name. On submit, the user lands on the app and the monthly setup modal fires immediately. The two flows read as one long form.

### 7.2 New structure

`setup.html` becomes a multi-step flow:

```
Step 1 of 2: Display name
  -> Back: (none)
  -> Next: Step 2

Step 2 of 2: Pick your diary cover
  -> Back: Step 1 (preserves name input)
  -> Continue: Handoff screen

Handoff screen
  -> Dismissed when user clicks "Plan April, →" CTA
  -> Fires the monthly setup modal

Monthly setup modal (existing flow from PO02)
  -> Decoration, activities, cadence
```

### 7.3 Step 2 copy (locked)

```
Pick your diary.

You'll be writing a lot in here, so pick one you won't get sick of.
Don't overthink it, you can swap it anytime.
```

Title: Fraunces italic 700, roughly 2.1rem on desktop.
First subtitle: Fraunces italic 400, ink-soft color.
Second subtitle ("Don't overthink it..."): Fraunces italic 400, ink-faint color, slightly smaller, visually subordinate.

### 7.4 Step 2 UI

Three covers shown at 140×180px (smaller than real size but large enough to feel substantive). Each cover sits in a selection card with 16px padding, 2px transparent border, `border-color: var(--red)` when selected.

Below each cover: the `displayName` in Fraunces italic 700, and the `materialLabel` in DM Mono uppercase small.

On mobile, covers stack vertically as rows (mini cover thumbnail 64×82px on the left, name and material on the right).

### 7.5 Navigation

- **Back button** on Step 2: returns to Step 1 with the name input still populated. Use `history.pushState` with a state object, listen for popstate, hydrate the form from state.
- **Step pips** below the cover grid: two 7px dots, one active (red), one inactive (hairline). Indicates progression.
- **Continue button**: red, rounded, copy "Continue, →" (voice pattern from PO02, comma before arrow).

### 7.6 State preservation

Navigating back-forward-back must not lose input. Pattern:

```
// On Next click from Step 1:
pushState({ step: 2, name: nameInput.value })

// On Back click from Step 2:
history.back()

// On popstate (back button or browser back):
render the step from state.step
if state.step === 1, hydrate nameInput.value from state.name

// On Continue from Step 2:
pushState({ step: "handoff", name, cover: selectedCover })
```

Firestore writes happen on Continue from Step 2, not on Next from Step 1. This avoids a partial user doc (`displayName` but no `diaryCover`) if the user abandons.

### 7.7 Settings entry point for display name

On-deck item 20 notes that users currently cannot edit their display name after setup. The back nav from Step 2 to Step 1 partially addresses this for first-time users, but for users already past setup, display name editing lives in the Phase 3 Settings panel under Account. Flag it in that spec when we write it.

---

## 8. The handoff moment

### 8.1 Why it exists

Right now `setup.html` flows directly into the monthly setup modal with no visual or tonal break. Reads as one long form. The handoff introduces a deliberate pause that gives setup a closing moment and monthly setup a fresh opening.

### 8.2 Structure

A full-viewport screen (not a modal) that replaces the setup UI after Step 2's Continue click. Layout:

```
  [4-point Mixtape sparkle in red]

         You're in.
     Now let's plan your first month.

       [ Plan April, → ]
```

### 8.3 Specs

| Element | Spec |
|---|---|
| Background | `var(--paper)` with the Mixtape drifting motif and warmth glow visible behind (reuses `.tex-3` class) |
| Top stripe | Same 4px red/yellow/blue gradient as setup.html |
| Sparkle | The 4-point Mixtape sparkle SVG (already used in monthly setup markers), 32px, `fill: var(--red)` |
| Title | Fraunces italic 700, ~2.4rem, `color: var(--ink)` |
| Subtitle | Fraunces italic 400, ~1rem, `color: var(--ink-soft)` |
| CTA button | Red, rounded, Manrope bold, "Plan {MonthName}, →" (dynamic month name) |
| Spacing | 96px top, 80px bottom, 48px sides, text center-aligned |

### 8.4 Copy variants

First-time only (after setup Step 2):
```
You're in.
Now let's plan your first month.
[ Plan April, → ]
```

Future monthly rollovers reuse this pattern (flagged for future work, out of scope for PO04 implementation but documented so the structure supports it):
```
[Month] is here.
Let's set it up.
[ Plan May, → ]
```

### 8.5 Motion

Entry: opacity 0 -> 1 over 320ms, cubic-bezier(0.22, 1, 0.36, 1). The sparkle scales from 0.8 to 1 over 420ms with a slight delay so it lands after the text.

Exit on CTA click: opacity 1 -> 0 over 280ms, monthly setup modal fires simultaneously with a crossfade.

---

## 9. Consolidated swatch colors

### 9.1 Current state

`swatchColors = { coral: "#C3342B", cream: "#ede2d0", indigo: "#2A2E45" }` is duplicated in four places across `js/tracker-diary.js` and `js/diary-mobile.js`. This is a refactor opportunity.

### 9.2 PO04 cleanup

Delete all four duplications. Add a single `swatch` field to each cover definition in `js/diary-themes.js` (soon `js/diary-covers.js`):

```js
bold: {
  id: "bold",
  displayName: "Bold",
  materialLabel: "Red leather",
  isPaid: false,
  price: null,
  swatch: "#C3342B",  // single source of truth for the picker swatch color
  coverGradient: "...",
  // ...
}
```

Update all picker implementations to read `DIARY_COVERS[key].swatch` instead of looking up a local constant.

### 9.3 File rename

Rename `js/diary-themes.js` -> `js/diary-covers.js`. Update all imports:

- `js/tracker-diary.js`
- `js/diary-mobile.js`
- `js/diary-strip.js` (if it imports)

This file rename is optional but recommended. If the rename creates too much noise in the PR, defer it. The behavior change (picker UI, new covers) is the priority.

---

## 10. Voice review

### 10.1 New strings

| String | Location | Voice check |
|---|---|---|
| `Pick your diary.` | Setup Step 2 title | Lowercase intentional? No, sentence case here because it's a title. Pass. |
| `You'll be writing a lot in here, so pick one you won't get sick of.` | Setup Step 2 subtitle | Sentence case, warm, specific, no em-dash. Pass. |
| `Don't overthink it, you can swap it anytime.` | Setup Step 2 soft subtitle | Sentence case, permission-giving, comma instead of em-dash. Pass. |
| `Continue, →` | Setup Step 2 button | Comma-before-arrow per PO02. Pass. |
| `You're in.` | Handoff title | Warm, short, friend-like. Pass. |
| `Now let's plan your first month.` | Handoff subtitle | Uses "let's" (collaborative), specific ("first month"). Pass. |
| `Plan April, →` | Handoff CTA | Dynamic month name, comma-before-arrow, imperative. Pass. |
| `just for April` | Per-month override indicator | Lowercase, understated. Pass. |
| `Bold` / `Quiet` / `Moody` | Cover display names | Sentence case. Names of emotional registers, not adjectives applied to diaries. Pass. |
| `Red leather` / `Cream linen` / `Navy and brass` | Cover material labels | Sentence case. Descriptive. Pass. |

### 10.2 Strings NOT changed

- Existing diary toast copy stays as-is
- Existing crop UI copy stays as-is
- `read it →` on the closed notebook stays as-is

### 10.3 Em-dash check

Scanned all copy. No em-dashes. Pass.

---

## 11. Visual review

### 11.1 Mixtape token compliance

Where the covers use Mixtape tokens directly:

- Bold cover: body hex is Mixtape red `#C3342B` at the lightest gradient stop. Gold accents are a different warm-hue family (not existing Mixtape tokens) because the spec allows decorative metals outside the core palette.
- Quiet cover: body hexes are Mixtape paper and paper-edge. Red accent corners and ribbon are Mixtape red.
- Moody cover: navy body hexes are NOT current Mixtape tokens. They're a new dark blue family tuned for a leather notebook feel. Brass accents are also outside core tokens.

### 11.2 Why the covers use non-token colors

Covers are decorative objects (like stickers, section 14 of MIXTAPE_SPEC). They live inside the Mixtape system but authored with a broader palette so they feel distinct from the chrome of the app. This matches the same logic as stickers.

### 11.3 Paper token compliance

Paper hexes stay exactly as they are in the current implementation (`#F2EDD8`, `#FAF7ED`, `#F5EDE0`, rule-line colors `#C8BD9C` and `#D5C9A8`). These are theme-independent per PO03. No new tokens needed.

### 11.4 Side A vs Side B review

The covers themselves render identically across Side A and Side B (material integrity). The frame around them (page background, modal backdrop, picker popover background) adapts to theme via existing tokens. Verified in mockup v2 section 1 and 2.

---

## 12. Out of scope

These exist in the mental model but do not ship in PO04:

- **Per-cover paper styles.** Dotted is universal. Phase B may introduce lined/grid/blank per cover.
- **Settings panel full build.** Deferred to Phase 3 Settings panel. The entitlements schema supports it, but the gallery UI is not built in this round.
- **Shop UI.** Deferred to Phase 4. The entitlements schema supports it. Cloud Function purchase validation is not authored in this round.
- **Paid cover designs.** Zero paid covers ship in PO04. The mockup shows an example "Velvet" locked cover for illustration only.
- **Monthly rollover handoff reuse.** The handoff pattern is only wired into first-time setup in this round. Future monthly rollovers using the same handoff ("May is here. Let's set it up.") are flagged but not built.
- **Display name edit for post-setup users.** Addressed only for first-time users via back nav from Step 2. Settings-level editing stays on-deck for Phase 3.
- **Cloud Function for entitlements writes.** Schema is defined, Firestore rules are set, but the server-side write path waits for Shop to exist. Until then, the seed function runs at signup (client-side, will migrate server-side at Shop launch).

---

## 13. Implementation checklist for VSCii

### 13.1 Files to create

- `scripts/migrate-diary-covers.mjs` (one-off, rename legacy keys and field)
- `scripts/backfill-entitlements.mjs` (one-off, seed `entitlements/{uid}` for existing users)
- `js/entitlements.js` (new module, client-side read helpers)

### 13.2 Files to modify

- `js/diary-themes.js` -> rename to `js/diary-covers.js`, add metadata fields, retune all three covers per Section 1, consolidate swatch colors per Section 9
- `js/diary.js` -> rename read helpers (`getDiaryTheme` -> `getDiaryCover`, `saveDiaryTheme` -> `saveDiaryCover`), add `getActiveCover` helper per Section 4
- `js/tracker-diary.js` -> update imports, replace dot-row picker with popover implementation, place Edit entry button below all content (after polaroid)
- `js/diary-mobile.js` -> same updates as tracker-diary.js for mobile paths
- `css/diary-book.css` -> replace ruled-paper gradients with dotted-paper gradients per Section 5
- `setup.html` -> multi-step structure, Step 2 cover picker, state preservation per Section 7
- `js/setup.js` -> handle multi-step nav, Firestore writes on Continue
- `css/setup.css` -> styles for Step 2 cover grid, handoff screen
- Firestore rules -> add `entitlements/{uid}` block per Section 3.4

### 13.3 Migration sequence

1. Deploy new `js/diary-covers.js` alongside old `js/diary-themes.js` (both work briefly)
2. Deploy read-path backward compatibility shim per Section 2.4
3. Run `migrate-diary-covers.mjs` against production Firestore
4. Run `backfill-entitlements.mjs` against production Firestore
5. Deploy PO04 UI changes (popover picker, dotted paper, setup restructure, handoff)
6. Remove `js/diary-themes.js` and the `mapLegacyKey` shim in a follow-up polish round once analytics confirm zero users on legacy keys

### 13.4 Testing

- First-time signup: setup Step 1 -> Step 2 -> handoff -> monthly setup -> app
- Back nav: from Step 2 to Step 1, name still populated
- Cover picker in closed notebook: select a cover, widget re-renders with new cover, Firestore writes
- Cover picker with per-month override: select an override on April, verify default stays unchanged
- Locked cover state: temporarily mark one cover `isPaid: true` and user not owning it, verify lock overlay renders
- Migration script idempotency: run twice, verify no duplicate work
- Entitlements rules: try writing to `entitlements/{uid}` from client, verify it fails

---

## 14. Build-log entry (for after ship)

```
Apr 22, 2026 · PO04 · Shipped
Polish · Diary cover system

Third polish round that touches the diary, and the biggest one. Three retuned cover
defaults (Bold, Quiet, Moody) as emotional registers, not color swaps. Every diary
paper surface becomes dotted (Ryder Carroll bullet journal gesture). The cover picker
UI moves from a row of colored dots to a popover of mini cover thumbnails, which
scales to N covers and supports lock overlays for when paid covers ship later.
An entitlements architecture (entitlements/{uid} Firestore doc) lands even though no
paid covers ship in this round. The data shape is ready.

Alongside the cover system: a setup flow restructure that introduces a proper step 2
for cover selection, fixes the display-name back-nav gap (on-deck item 20), and adds
a handoff moment between setup and monthly setup so the two flows stop feeling like
one long form.
```

---

*Locked April 22, 2026. Built by Jen & Cii.* 🪨
