# Mixtape -- showup. Design Playbook

> The canonical source of truth for showup.'s visual, typographic, motion, and voice system.
> All redesign and future feature work references this document.

---

## Table of Contents

1. [Philosophy](#1-philosophy)
2. [Tone & Voice](#2-tone--voice)
3. [Hard Rules](#3-hard-rules)
4. [Design Tokens](#4-design-tokens)
5. [Motion Language](#5-motion-language)
6. [Core Components](#6-core-components)
7. [Empty & Error States](#7-empty--error-states)
8. [Responsive System](#8-responsive-system)
9. [Mobile Layout](#9-mobile-layout)
10. [Brand Identity](#10-brand-identity)
11. [Theme System](#11-theme-system)
12. [Iconography](#12-iconography)
13. [Migration Plan](#13-migration-plan)
14. [Open Questions](#14-open-questions)

---

## 1. Philosophy

### The aesthetic

Mixtape. Warm 90s and early-2000s nostalgia, not literal. Mid-century book meets cassette tape. The only "mixtape" vocabulary that reaches the UI is "Side A" and "Side B" in the theme picker. Everything else is warm editorial restraint.

### The product posture

showup. is **95% personal, 5% social**. The tracker and diary are the product. Following and All tabs are supporting features, not the center of gravity. Every design decision respects this ratio.

showup. is **premium-first, monetization-minded**. The design quality sets a bar that justifies paid themes and future paid tiers. The app should feel worth paying for before we charge anyone.

### The five brand pillars

Every component, every copy string, every animation answers to these five.

1. **The tracker is the heartbeat.** It's what brings people back daily. Never obscure it, never bury it, never slow it down.
2. **The diary is the emotional peak.** It's where the product becomes personal. Protect its intimacy.
3. **Warm analog, crisp digital.** Paper and ink on the surface, precision and speed underneath. Both matter.
4. **Quiet by default, personality on contact.** The app doesn't shout. It reveals itself as you use it: motifs drift, copy surprises, animations reward attention.
5. **Specific, not generic.** Copy uses the person's name. Activities are named inline. Signals reference the actual moment, not a placeholder template.

### Side A / Side B

- **Side A** is the default light theme. Cream paper, deep ink, confident red. Friendly, legible, welcoming. "Daytime showup."
- **Side B** is the default dark theme. Maroon leather, warm cream text, salmon red, teal accent. Quiet, contemplative, evening. "Showup. in the evening."

Side B is not "Side A with the lights off." It has its own emotional register. Together they form one cassette with two sides -- same band, different mood per side.

---

## 2. Tone & Voice

### Voice principles

showup. sounds like a quietly observant friend who pays attention. Not a coach, not a cheerleader, not a life-hack blog. The five traits:

- **Warm.** Never cold, never clinical.
- **Specific.** Uses real names, real activities, real moments.
- **Quietly observant.** Notices things without announcing it.
- **A little sarcastic, sometimes.** Only when the moment earns it. Never mean.
- **Never performative.** No fake enthusiasm, no corporate cheerfulness.

### Voice by context

| Context | Calibration |
|---------|-------------|
| Streak hit / milestone | Celebratory but grounded. "day 25. still showing up." |
| Low key signal copy | Observational, third-person-ish, warm. Uses first name. |
| Ghost / absence | The feed itself speaking. No person named. Poetic restraint. |
| Diary copy | Personal, intimate, lowercase where appropriate. |
| Error messages | Direct, kind, specific. Never alarming. |
| Confirm dialogs | One word or two. "Sure?" not "Are you sure you want to do this?" |
| Empty states | Patient, gentle. Never "no data found." |

### Do's and Don'ts

| Instead of | Say |
|------------|-----|
| "No activities found for 2026-04" | "no tracker this month" |
| "Error: Failed to save data" | "Couldn't save. Try again." |
| "Are you sure you want to unfollow?" | "Unfollow? Sure?" |
| "User has disabled sharing" | "Gone quiet for now." |
| "You have 3 new notifications!" | "three new today." |
| "Please wait while we load your data" | "one moment..." |
| "Successfully saved!" (toast) | "saved." |
| "Oops! Something went wrong." | "That didn't go through." |

### Intentionally lowercase

showup. lowercases certain words for intimacy and texture. These are deliberate, not careless.

- `diary.` (the feature name and section label)
- `crickets` (the empty section in People view)
- `no tracker this month`
- Toasts: `saved.` `synced.` `couldn't save.`

Sentence case stays for headings, proper nouns, button labels, and anywhere formality serves clarity.

### Forbidden patterns

- **Em-dashes.** Anywhere. Ever. Use a comma, period, semicolon, colon, or parentheses. This is a hard rule (see Section 3).
- **Exclamation points** unless the moment is genuinely celebratory. "streak!" on a milestone card is fine. "Welcome!" on a login screen is not.
- **"The user"** in any user-facing string. Say "you" or use their first name.
- **AI-ish phrasing.** "I'd be happy to help." "Let me know if..." This is a product, not an assistant.
- **Startup cheerfulness.** "Oops!" "Whoops!" "Looks like..." If something failed, say what failed. With kindness.
- **Generic placeholders.** "your activities" when we could say the actual activity names.

### Copy review checklist

Before shipping any user-facing string, run it through these:

1. Would a friend say this?
2. Is it specific to showing up, or generic?
3. Does it use the person's name if it should?
4. Does it respect the 95% personal / 5% social ratio?
5. Is anything here an em-dash? (If yes, fix immediately.)
6. Does it need an exclamation point or is that fake enthusiasm?

---

## 3. Hard Rules

These cannot be overridden by any design decision, feature request, or user preference. Breaking a hard rule breaks the system.

### Design system

- **Red is the hero across every theme.** Not blue, not green, not purple. The red hue may shift per theme (Side A `#C3342B`, Side B `#F07A5E`), but red is always the signature.
- **The stripe order is always red / yellow / [blue or teal]**, left to right. The third color may vary per theme; the first two never move.
- **Sora 800 is the logo font.** Everywhere. At every size. No exceptions.
- **Only "up" in the wordmark gets the red highlight.** The period stays in the normal text color. The standalone mark is a separate asset (see Section 10).
- **Active nav state is always the full ink pill with red track number.** Not an underline, not a border, not a color swap on the label.
- **Level 3 texture is the texture.** Do not introduce new noise patterns, scanlines, or filters. Level 3 is grain + drifting warmth glow + drifting motif layer.

### Privacy

Cross-referenced from FOLLOWING_SPEC.md. Three rules that never break:

1. A follower sees the same card in Following tab and All tab. Always identical.
2. Low key and Ghost are audience-agnostic. Same treatment for followers and strangers.
3. Private cascades both Calendar and Diary. Always.

### Copy

- **No em-dashes.** Covered in Section 2. Repeating here because it is a hard rule.
- **No exclamation points** unless the moment is genuinely celebratory.
- **Never "the user"** in any UI string.
- **Never AI-ish phrasing.** The app is an app, not an assistant.

### Engineering

Cross-referenced from ROCKSTACK.md.

- **Modularize aggressively.** No file bloats past reasonable size. Reusable UI elements (toast, spinner, modals, feed cards, diary strip) are modularized and imported, never duplicated.
- **Design tokens live in `css/variables.css`.** Never hardcode hex values in component CSS. Exception: mockups in `mockups/`.
- **Shared modules** (`following-utils.js`, `feed-card.js`, `diary-strip.js`, etc.) are single-source-of-truth. If you find yourself writing a new utility, check first if it already exists.
- **Firestore paths** are canonical and documented. See Section 13 and FEED_SPEC.md.

---

## 4. Design Tokens

### Side A (Light) palette

| Token | Hex | Role |
|-------|-----|------|
| `--paper` | `#F4ECD8` | Primary surface |
| `--paper-deep` | `#ECE1C6` | Elevated surfaces, pressed states |
| `--paper-edge` | `#DCCFA6` | Rarely used; deepest paper tint |
| `--ink` | `#2A1F1A` | Primary text, active pill background |
| `--ink-soft` | `#5A463A` | Secondary text, body paragraphs |
| `--ink-faint` | `#9C8874` | Tertiary text, metadata, timestamps |
| `--red` | `#C3342B` | Hero. Logo accent, stripe, badge, active-state indicators |
| `--red-hover` | `#A62822` | Red on hover |
| `--red-wash` | `#F5D9D5` | Red tinted for sun column backgrounds |
| `--blue` | `#4F6C8E` | Supporting. Activity dot color, stripe segment, chart lines |
| `--yellow` | `#E8B33A` | Supporting. Diary dot indicator, stripe segment, warmth glow |
| `--green` | `#3E5C3A` | Rare. Activity dot color only |
| `--hairline` | `#D4C3A1` | Borders, dividers, faint rules |

### Side B (Dark) palette -- Warm leather

| Token | Hex | Role |
|-------|-----|------|
| `--paper` | `#2A1518` | Primary surface (maroon) |
| `--paper-deep` | `#1D0E10` | Elevated surfaces, pressed states |
| `--text` | `#F0DCCF` | Primary text (warm cream) |
| `--text-soft` | `#B18A84` | Secondary text |
| `--text-faint` | `#6E504B` | Tertiary text, metadata |
| `--red` | `#F07A5E` | Hero. Salmon-warmed for dark maroon background |
| `--yellow` | `#E8B33A` | Supporting. Same as Side A |
| `--teal` | `#5EAAA8` | Supporting. Replaces blue. Activity dot, stripe segment |
| `--hairline` | `#4A2025` | Borders, dividers |
| `--sidebar` | `rgba(46, 27, 26, 0.78)` | Sidebar background, warmer than paper |
| `--active-pill-bg` | `#F0DCCF` | Active nav pill (same as text color) |
| `--active-pill-text` | `#1D0E10` | Text inside active pill |

The stripe on Side B is red / yellow / teal (not red / yellow / blue like Side A).

### Typography

| Font | Weight | Role |
|------|--------|------|
| Sora | 800 | Logo, wordmark. Never used elsewhere. |
| Fraunces | 400, 500, 600, 700 | Display, headings, italic emphasis. `<em>` renders italic 400. |
| Manrope | 400, 500, 600, 700 | Body copy, UI labels, buttons |
| Caveat | 400, 500, 600, 700 | Handwriting. Used inside the diary only. |
| DM Mono | 400, 500 | Metadata, timestamps, track numbers, ratios |

Fraunces uses optical sizing (`opsz` axis). Display-size headings (`>= 1.5rem`) should use higher opsz values; inline italics stay at default.

### Spacing scale

| Token | Value |
|-------|-------|
| `--r-sm` | 6px |
| `--r-md` | 10px |
| `--r-lg` | 16px |

Padding and gaps follow an 8px grid at the component level (8, 12, 16, 24, 32, 40). Vertical rhythm is relaxed; there is no enforced baseline grid.

### Shadows

| Token | Value |
|-------|-------|
| `--shadow-soft` | `0 1px 2px rgba(42, 31, 26, 0.06), 0 2px 6px rgba(42, 31, 26, 0.04)` |
| `--shadow-card` | `0 2px 4px rgba(42, 31, 26, 0.08), 0 8px 24px rgba(42, 31, 26, 0.06)` |

Side B uses the same shadow values with lower opacity; maroon absorbs shadow better than cream.

---

## 5. Motion Language

### Principles

- **Fast enough to feel snappy, slow enough to feel considered.**
- **Spring cubic-bezier**, `cubic-bezier(0.22, 1, 0.36, 1)`, for entrances and position changes. iOS-feel.
- **Opacity crossfades** for content swaps. No slide transitions for panels with variable heights (they break visually).
- **Stagger for grid items** on first render. Index-based, 40-60ms per step.
- **Reduced motion** is always respected via `@media (prefers-reduced-motion: reduce)`. Drifting backgrounds, spinning loaders, and ornamental animations all disable. Functional transitions stay.

### Duration scale

| Duration | Use |
|----------|-----|
| 120-180ms | Hover, focus, small state changes |
| 220-280ms | Modal open/close, tab switch, bottom sheet |
| 350ms | Staggered grid item entry, feed card entry |
| 55s | Drifting warmth glow (background gradient) |
| 70s | Drifting motif layer (SVG pattern) |

### Ambient motion

Level 3 texture includes two continuous, slow animations on the background:

1. **Warmth drift.** Radial gradient in red/yellow/accent, translating and rotating slowly over 55s. Creates a subtle breathing quality.
2. **Motif drift.** SVG pattern of stars, dots, squiggles, shifting linearly over 70s.

Both respect reduced-motion preferences. Both run at the frame/shell level, not per-component.

---

## 6. Core Components

### Sidebar (desktop) -- V3 Hybrid 1

The canonical desktop nav. Grid column, 240px wide.

**Structure (top to bottom):**
1. Hand-drawn motif above the logo (currently placeholder, to be refined)
2. Logo: `showup.`
3. Nav items (6): My log, Diary, Following, All, Shop, Settings
4. Bottom foot (user chip + theme pill), pushed to bottom with `margin-top: auto`

**Visual rules:**
- Background: `rgba(236, 225, 198, 0.4)` (Side A) or `rgba(46, 27, 26, 0.78)` (Side B), with `backdrop-filter: blur(6px)`
- Border-right hairline between sidebar and content
- Nav items: rounded pills (`99px`), mono track number on the left (01, 02, ...), label on the right in Manrope
- Active state: **full ink-black pill with cream text and red track number**. This is the single most Mixtape-specific nav treatment and must never be replaced with a color swap or underline.

### Stripe

A 5px tall horizontal gradient bar spanning the full top of the page on desktop. Colors: `red 0 33%, yellow 33% 66%, accent 66% 100%`. Accent is `blue` on Side A and `teal` on Side B.

Implementation note: the stripe sits on a `.stripe-wrap` parent *outside* the textured frame. This is so the stripe renders *above* the texture's `overflow: hidden` clip. Putting the stripe inside the frame clips it.

### Tracker badge

The red pill that holds the user's identity on their tracker card. Structure: avatar circle + display name + optional "you" pill + optional menu button.

On Side A the badge background is red (`#C3342B`), text is cream. On Side B the badge background is salmon (`#F07A5E`), text is paper-deep.

### Tracker card

The container for a user's monthly activity log. On desktop it shows a row-per-activity layout. On mobile it shows a 7-column month grid with colored dots per day per activity.

See `js/cal-card.js` for the canonical mobile implementation. See `js/tracker.js` for desktop.

### Texture / motif layer

Applied to the main content area via a `.tex-3` class. Three layered backgrounds:

1. **Grain.** SVG noise at low opacity, scaled 260x260.
2. **Warmth glow.** Radial gradients tinted with theme accents, drifting 55s.
3. **Motif pattern.** SVG of stars, dots, squiggles in theme colors, drifting 70s.

The motif SVG is different per theme to match the palette. See the `--side-motif-svg` custom property for each theme.

### Modals

- Entrance: opacity 0 → 1, scale 0.96 → 1, 280ms `cubic-bezier(0.22, 1, 0.36, 1)`
- Exit: opacity 1 → 0, scale 1 → 0.98, 220ms
- Backdrop: `rgba(42, 31, 26, 0.6)` (Side A) with `backdrop-filter: blur(4px)`
- Max width: 420px default; 680px for wide modals (diary overlay, manage activities)

### Toasts / spinners

Shared modules (`js/ui.js`). Must not be reimplemented per-feature.

- Toasts: bottom-center on mobile, bottom-right on desktop. 3s default. Variants: default, error, success.
- Spinners: one canonical spinner lives in `css/ui.css`. Backlog item 17 will replace with a custom showup. spinner. Until then, use the default.

---

## 7. Empty & Error States

Empty and error states are copy-critical. They happen at emotional moments (a new user with nothing logged, a failed diary save) and must sound like showup., not like a stack trace.

### Empty states

| Context | Copy |
|---------|------|
| No activities set up for the month | "no tracker this month" |
| Crickets section (no follows tracking this month) | "crickets" + "Last tracked: [month]" |
| New user, no follows yet | "Nobody yet. Head to the All tab." |
| Feed, no events yet | "Nothing new. Everyone's quiet today." |
| Search, no results | "nothing matching that." |
| Diary, no entries yet | "no entries yet. today's a blank page." |

### Error states

| Context | Copy |
|---------|------|
| Save failed | "Couldn't save. Try again." |
| Network error, retry possible | "Lost the connection. One sec." |
| Permission error (rare, user-facing) | "Can't access that right now." |
| Image upload failed | "Photo didn't upload. Try again?" |
| Auth expired | "Signed out. Log back in?" |

### Edge cases

The design system must gracefully handle:

- **0 activities**: card renders with empty calendar grid and "no tracker this month" copy
- **1 activity**: calendar dots are all one color; legend shows the single activity
- **20+ activities**: day cells show max 5 dots + "+N" overflow indicator; legend wraps to multiple lines
- **0 follows**: Following tab shows empty-state copy and a CTA to All tab
- **500+ feed events**: feed uses pagination or virtualization (engineering concern, not design)

---

## 8. Responsive System

### Breakpoints

| Name | Min width | Max width | Context |
|------|-----------|-----------|---------|
| Mobile | 0 | 767px | Phones, bottom-nav app shell |
| Tablet | 768px | 1023px | Rare. Treated as desktop with slightly tighter spacing. |
| Desktop | 1024px | -- | Full V3 sidebar layout |

The `768px` breakpoint is already baked into `css/layout.css` and should not change.

### What scales

- **Typography:** display sizes scale down 20-25% on mobile. Body text stays 16px.
- **Paddings and gaps:** halve on mobile (32 → 16, 24 → 12).
- **Card radii:** stay the same. `--r-lg` is 16px everywhere.
- **Texture:** motif scale drops on mobile (260px tiles) to keep motifs visible at smaller sizes.

### What changes per viewport

- **Nav:** desktop uses the V3 sidebar. Mobile uses a bottom nav + header.
- **Month nav:** desktop has a dedicated month bar. Mobile inlines it into the header row.
- **Tracker layout:** desktop shows rows per activity. Mobile shows a 7-column grid with dots.
- **Pinned panel (Following tab):** desktop shows it on the right. Mobile shows it at the top of the feed.

### What stays constant

- **Palette.** Same hex values at every viewport.
- **Typography stack.** Same fonts.
- **Stripe colors.** Same gradient order.
- **Motion principles.** Same cubic-bezier, same durations.
- **Voice.** Copy is identical regardless of viewport.

---

## 9. Mobile Layout

### Variant M3 (Balanced)

The locked mobile variant. Stripe is position C (above the bottom nav). Header is clean, personality lives in the bottom nav active state.

### Header structure

Left to right: **Logo · Shop · Theme · Avatar**

- **Logo:** `showup.` in Sora 800, `1.2rem`.
- **Shop:** icon button, opens the Shop (paid themes).
- **Theme:** icon button, quick-toggles Side A / Side B. Frequent action, stays in header.
- **Avatar:** 30px circle with user initial in red. Tap opens the Settings menu.

### Bottom nav

Four tabs, left to right: **Mine · Diary · Following · All**

- Each tab: icon above, lowercase label below.
- Active state: full ink pill background, cream text, red icon accent. Same visual logic as the desktop V3 active pill.
- Inactive state: text-faint color, default icon color.
- Stripe sits as a 2px top border on the nav bar (position C from the identity study).

### Settings panel

Accessed via Avatar tap → Settings. Four sections plus one stub:

1. **Privacy.** Calendar tier + Diary tier pickers. (Inherits the current privacy modal.)
2. **Appearance.** Theme toggle (Side A / Side B). Once Shop launches, this section shows the active theme and links to Shop for more.
3. **Account.** Display name (editable), email (read-only), sign out.
4. **Notifications.** *Stub for future.* Shows "Coming soon." No functionality in v1.
5. **About.** Version, tagline ("Show up. Period."), link to build-log, link to jeni.rocks.

Settings panel opens as a full-height bottom sheet on mobile (drag-to-dismiss), or a centered modal on tablet+.

### Mobile nav: Shop vs Settings

- **Shop** is a header icon because it is a destination (a full panel with themes, pricing, purchase flow).
- **Settings** is under Avatar because it is a user-preference menu, not a destination.

This mirrors how most mobile apps handle the distinction.

---

## 10. Brand Identity

### Wordmark

`show[up].` -- "up" is in the theme red, period is in the normal text color.

- **Font:** Sora 800.
- **Letter spacing:** `-0.03em`.
- **Line height:** `1`.
- **Usage:** Anywhere the brand is represented in text form. Header, login screen, footer, document titles.

The "up" accent is the entire logo flourish. No underlines, no italics, no other treatments.

### Tagline

**"Show up. Period."**

- Used on login screen, About panel, and anywhere we need one-sentence brand positioning.
- Spelled with sentence case and two periods. Never all caps, never all lowercase.
- The double meaning ("just show up, end of story" + "showing up, literally the period") is intentional.

### Standalone mark

A red square on a dark (ink) background. Represents the period from the wordmark.

**Specs:**
- Canvas: square, any size from 16×16 to 512×512.
- Background: `#2A1F1A` (Side A ink) at all sizes. Universal -- works in browser tabs, on home screens, in social avatars.
- Mark: red `#C3342B` square, roughly 40% of canvas width, centered slightly below canvas center to echo Sora's period position.
- Corners: sharp. Not rounded. Sora's period is square.

**Asset locations:**
- `assets/icons/favicon.svg` (16×16 and 32×32 renders)
- `assets/icons/app-icon.svg` (512×512 master, PWA manifest)
- `assets/icons/mark.svg` (generic, for social avatars, README headers, etc.)

### When to use wordmark vs mark

| Context | Use |
|---------|-----|
| App header, login screen, footer | Wordmark |
| Browser tab, browser bookmark | Mark (favicon) |
| Home screen, PWA install, app launcher | Mark (app icon) |
| Social avatars (Twitter, LinkedIn, GitHub) | Mark |
| README header, documentation logos | Mark or wordmark, either works |
| Marketing hero images | Wordmark |

The mark exists so the brand has presence in any square or circle frame. It is never a replacement for the wordmark inside the product itself.

---

## 11. Theme System

### How theming works

Every theme is a set of CSS custom properties. The theme switcher changes the value of `data-theme` on `<html>`, which triggers a different token layer.

```css
:root[data-theme="side-a"] { --paper: #F4ECD8; --ink: #2A1F1A; /* ... */ }
:root[data-theme="side-b"] { --paper: #2A1518; --ink: #F0DCCF; /* ... */ }
```

Components read from tokens (`var(--paper)`, `var(--ink)`, etc.) and never hardcode hex values. This means a theme change is a token swap, nothing more.

### Default themes

- **Side A** is the default for new users.
- **Side B** is toggled via the Theme pill in the sidebar foot (desktop) or the header (mobile).
- User's choice persists in Firestore on the user doc: `users/{uid}.theme = "side-a" | "side-b" | "theme-id"`.

### Paid themes architecture (Shop)

Future paid themes extend the same token system. Each paid theme:

1. Defines a full token set (palette, stripe colors, motif SVGs, maybe custom shadows).
2. Registers itself in `js/themes.js` with metadata (name, price tier, preview image).
3. Appears in the Shop panel for purchase or in Appearance for selection if owned.

**Paid theme candidates from exploration (preserved as future Shop inventory):**

| Option | Name idea | Vibe |
|--------|-----------|------|
| Option 1 | Aged tobacco | Cognac bar, warm brown |
| Option 3 | Night kitchen | Neutral warm dark, daily driver |
| Option 6 | Violet night | 2am TV glow, dreamy |
| Option 7 | Magenta bruise | Velvet curtain, theatrical |
| Option 8c | Teal-tinted shadow | Warm content + cold sidebar |
| Option 9 | Deep teal abyss | Workshop at midnight, architectural |
| Rockstar | Black + red + white | Concert poster, paid premium |

Each of these is a locked palette from the exploration phase. Implementation order is a Shop launch decision.

### Theme authoring rules

- **Red stays the hero.** The red hue may shift per theme; red is always the signature accent.
- **Stripe order is always red / yellow / [accent].** Accent may be blue, teal, lilac, etc.
- **Three-color palette minimum.** Any new theme must define red, yellow, and an accent. Single-hue themes are not permitted.
- **Contrast ratio must pass WCAG AA** for body text against background.
- **Motifs must be tuned per theme.** Don't reuse Side A's motif SVG on a dark theme; the colors won't show.

---

## 12. Iconography

Iconography is out of scope for this document. It will be documented in a future `ICON_SPEC.md` covering:

- Current icon audit (what icons exist, where they're used, at what sizes)
- Stroke weight standard (expected: 1.5px at 24px base)
- Corner radius standard
- Fill vs outline rules
- Monotone (`currentColor`) vs multi-tone
- When to use which icon
- How to add a new icon
- Brand motifs (stars, squiggles, dots) as a separate category from functional icons

Until `ICON_SPEC.md` exists, icons in the live app continue to follow current conventions. The Mixtape redesign does not change icon shapes, only their tint (via `currentColor` inheriting theme tokens).

---

## 13. Migration Plan

### Principle

The Mixtape redesign is a **token and structure migration**, not a rewrite. Existing features (tracker, diary, following, all, feed) keep their logic and data paths. What changes:

1. `css/variables.css` -- full token replacement
2. Component CSS files -- switch to new tokens, adopt V3 sidebar structure
3. `index.html` -- add sidebar shell, update header structure for desktop
4. Mobile layout -- adopt M3 variant (bottom nav structure, Settings menu)
5. Assets -- new favicon, new app icon, updated mark

### File-by-file migration order

The recommended sequence for implementation PRs:

1. **`css/variables.css`** -- Add Side B token layer, add paid-theme placeholder layer. Keep Side A tokens backward-compatible during transition.
2. **`css/base.css`** -- Load Mixtape fonts (Fraunces, Manrope, DM Mono, Caveat) via Google Fonts. Sora is already present.
3. **`index.html`** -- Add desktop sidebar shell. Keep legacy tab row hidden on desktop, visible on mobile.
4. **`css/layout.css`** -- Rewrite for V3 sidebar on desktop. Mobile header gets new Shop/Theme/Avatar icons. Mobile bottom nav gains Diary tab (4 tabs total).
5. **`css/tracker.css`** and related component CSS -- switch hardcoded colors to tokens. Pure find-and-replace.
6. **`assets/icons/favicon.svg`** -- replace with new red-on-ink favicon.
7. **`assets/icons/app-icon.svg`** -- create for PWA.
8. **`assets/icons/mark.svg`** -- create generic standalone mark.
9. **Settings panel** (new) -- implement the four-section Settings menu accessible via Avatar tap.
10. **Shop stub** (new) -- placeholder Shop route. Full implementation is a post-migration feature.

### What could break

- **Privacy modal styling.** Currently styled for the old navy theme. Will need token updates to match Side A / Side B.
- **Lottie animations.** The Lottie player is loaded globally in `index.html`. If any existing Lotties hardcode colors that now clash with the new palette, they need re-exporting.
- **Diary notebook widget.** Currently has three color themes (coral/cream/indigo). These remain user-selectable but should be re-tuned to harmonize with the new Side A palette. See `css/tracker.css` for the diary widget styles.
- **Manage Activities modal amber/green highlights.** Uses specific hex values. Should switch to semantic tokens.
- **Third-party components.** None currently, but if any are introduced during migration, they must respect tokens.

### Rollout strategy

- **Phase 1:** Ship Side A only. New palette, new structure, new sidebar. Side B toggle shows Side A until Phase 2.
- **Phase 2:** Ship Side B. Theme toggle works. User choice persists in Firestore.
- **Phase 3:** Ship Settings panel with all four sections functional. Notifications stub shows "Coming soon."
- **Phase 4:** Ship first paid theme (Rockstar is the priority candidate). Shop stub becomes a functional Shop panel.

Phases are independent. Side B can ship without Settings. Settings can ship without Shop. Each is a self-contained PR sequence.

### What does not change

- **Firestore schema.** Privacy tiers, diary paths, log paths, following arrays -- all unchanged.
- **Firestore rules.** No rule changes needed for the redesign itself.
- **Auth flow.** Google Sign-In unchanged.
- **Cloud Functions.** None required for the redesign.

---

## 14. Open Questions

Things we've intentionally parked. These do not block the redesign implementation but need resolution before their related features ship.

### Hand-drawn motif above the logo

The sidebar currently shows a placeholder motif (squiggle + dot + star SVG) above the logo. This will be refined in a future pass. The final motif should:

- Feel hand-drawn, not geometric
- Use only theme-available colors
- Work at the sidebar's tight width (~44×12px)
- Scale gracefully to larger uses (landing page, marketing)

Refinement scope: art direction + SVG execution. Likely requires a brief exploration round.

### Shop mobile placement (long-term)

Shop is planned as a header icon on mobile. For v1 this works because Shop is a small surface (theme picker + purchase flow). As Shop grows (more themes, bundles, subscription management), the header icon may need to become a full screen or a more-tab overflow.

Revisit when Shop has 5+ themes.

### Diary theme harmonization

The diary widget supports three user-selectable themes (coral, cream, indigo) from DI01. These need retuning to harmonize with the Mixtape palette. Options:

- Retune existing three to match Side A accents
- Expand to match both sides (warm set for Side A, cool set for Side B)
- Make diary themes independent of app theme (current behavior)

Decision deferred until first post-migration sprint.

### Custom spinner

Backlog item 17. Current spinner is generic. A custom showup. spinner (small drifting dot, or a rotating period from the wordmark, or a cassette tape spooling) would match the brand better.

### Mobile Shop placement evolution

Related to "Shop mobile placement (long-term)" above. When Shop grows past a simple theme picker, the mobile header icon may need to become a full tab or live in a "More" overflow. Revisit at Shop v2.

### Motifs on low-end devices

The drifting motif animation uses SVG background-position animation. On very low-end Android, this may cost more than it's worth. Consider:

- Dropping motif animation entirely on devices with slow GPUs
- Using `@media (prefers-reduced-motion: reduce)` as a proxy for low-end
- Adding a user preference in Settings → Appearance → "Reduce motion"

Revisit after launch metrics confirm the concern is real.

---

## Appendix: Related specs

- [`ROCKSTACK.md`](./ROCKSTACK.md) -- Engineering stack, workflow, file structure
- [`FOLLOWING_SPEC.md`](./FOLLOWING_SPEC.md) -- Privacy tiers, follow model, Pinned/Showing Up/Crickets
- [`FEED_SPEC.md`](./FEED_SPEC.md) -- Feed behavior, card states, tier matrix
- [`FEED_EVENT_SPEC.md`](./FEED_EVENT_SPEC.md) -- Event-stream model, debounce, copy variants
- [`ALL_TAB_SPEC.md`](./ALL_TAB_SPEC.md) -- All tab card types, search scoring
- [`ICON_SPEC.md`](./ICON_SPEC.md) -- *To be written.* See Section 12.

---

*Locked April 2026 after a session that covered: six Side A palette studies, four texture levels, five typography comparisons, five sidebar variants, four A/E hybrids, nine Side B palette options, five sidebar variants for Option 8, three finalists at full mockup scale, three mobile variants at two widths, one combined brand identity study. Side A locked first, then Side B (Option 8d Warm leather), then mobile M3, then the ribbon + wordmark + mark.*

*Built by Jen & Cii* 🪨
