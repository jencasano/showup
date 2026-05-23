# Feed Milestone Card Treatment Spec

> Visual treatment for feed event cards that represent a milestone moment.
> Companion to FEED_EVENT_SPEC.md. Mockup: mockups/milestone-card-mockup-v2.html

---

## Overview

Milestone moments (streaks, comebacks, first-ever days) already surface through the feed's copy system. The copy tells you what happened. But visually, a "25 days straight" card looks identical to a "logged Workout" default card. This spec adds a visual treatment layer so milestone cards feel distinct before you read a word.

The treatment is additive. Same card structure, same copy system, same rendering pipeline. A CSS modifier class and a badge swap are the only changes.

---

## Which Contexts Earn the Treatment

The milestone treatment applies when the event's contextKey matches one of these values:

| contextKey | Badge label | Earns milestone treatment |
|---|---|---|
| first_ever | day one | Yes |
| comeback_big | comeback | Yes |
| comeback_small | comeback | Yes |
| streak_7 | 7-day streak | Yes |
| streak_15 | 15-day streak | Yes |
| streak_25 | 25-day streak | Yes |
| streak_full_month | perfect month | Yes |
| streak_3 | (no change) | No -- too early to celebrate |
| backfill | (no change) | No -- filling in a past day is not a moment |
| default | (no change) | No |

---

## Visual Treatment: Three Layers

The milestone treatment is a hybrid of two explored options (warm wash + top accent stripe), plus an enhanced badge. All three layers work together.

### 1. Warm background wash

The card's background shifts from var(--bg-surface) to a subtle yellow-tinted mix.

| Theme | Token | Value |
|---|---|---|
| Side A | --milestone-wash | color-mix(in srgb, #E8B33A 5%, #ECE1C6) |
| Side B | --milestone-wash | color-mix(in srgb, #E8B33A 4%, #1D0E10) |

The wash is intentionally faint. Enough to distinguish the card from its neighbors when scanning the feed, not enough to look like a warning or alert.

### 2. Top accent stripe

A thin gradient stripe (2.5px) across the top edge of the card, rendered via ::before pseudo-element.

Gradient: var(--yellow) at 0%, fading to 40% opacity at 70%, transparent at 100%. Reads left-to-right as a warm highlight that tapers off.

Border-radius matches the card's top corners so the stripe doesn't clip.

### 3. Milestone badge (replaces tier badge)

When a card earns the milestone treatment, the tier badge (SHARING / LOW KEY / GHOST) is replaced with a contextual milestone badge. The badge uses a gold color family with a soft glow and a shimmer animation.

**Badge labels by context:**

| contextKey | Badge text |
|---|---|
| first_ever | day one |
| comeback_big | comeback |
| comeback_small | comeback |
| streak_7 | 7-day streak |
| streak_15 | 15-day streak |
| streak_25 | 25-day streak |
| streak_full_month | perfect month |

**Badge tokens:**

| Token | Side A | Side B |
|---|---|---|
| --milestone-badge-bg | rgba(184, 134, 11, 0.12) | rgba(232, 179, 58, 0.14) |
| --milestone-badge-color | #9A7B1A (darkened gold) | #E8B33A (bright yellow) |
| --milestone-badge-border | rgba(184, 134, 11, 0.30) | rgba(232, 179, 58, 0.35) |
| --milestone-badge-glow | 0 0 8px rgba(232,179,58,0.25), 0 0 3px rgba(232,179,58,0.15) | 0 0 10px rgba(232,179,58,0.30), 0 0 4px rgba(232,179,58,0.20) |

Side A uses a darkened gold (#9A7B1A) for badge text because bright yellow reads poorly against cream. Side B uses the full yellow since it pops cleanly against maroon.

**Badge shimmer animation:**

A subtle light sweep across the badge surface, implemented as a ::after pseudo-element with a translucent gradient that slides via background-position animation. 3-second cycle, ease-in-out, infinite. Respects prefers-reduced-motion (animation: none).

The shimmer is the showup. version of a celebration. Not confetti, not fireworks. Just a quiet glint that says "this one earned something."

---

## Per-Tier Behavior

### Sharing

Full milestone treatment: wash + stripe + milestone badge. The tier badge (SHARING) is replaced with the milestone badge. Left border stays var(--red). Copy includes activity names, streak commentary, and optional nudge as usual.

### Followers

Viewer is always a follower in the feed, so this renders identically to Sharing. Same milestone treatment.

### Low key

Full milestone treatment: wash + stripe + milestone badge. The tier badge (LOW KEY) is replaced with the milestone badge. Left border stays var(--accent-support). Copy is insight-only (no activity names) as usual.

### Ghost

Reduced milestone treatment. The wash is dialed down (3% yellow mix instead of 4-5%). The top stripe renders at 50% opacity. The badge glow is softer. This prevents the milestone treatment from fighting the ghost card's inherent reduced opacity (0.78). The milestone is acknowledged but stays muted, respecting the ghost's closed-door aesthetic.

The badge still replaces the GHOST tier badge with the milestone badge. Ghost copy stays poetic and reveals nothing.

### Private

Not applicable. Private users do not appear in the feed.

---

## CSS Implementation

### New class

.evt--milestone added to the card element alongside the existing tier class (.evt--sharing, .evt--lowkey, .evt--ghost).

### New tokens in variables.css

Six new custom properties on :root and [data-theme="side-b"]:
- --milestone-wash
- --milestone-badge-bg
- --milestone-badge-color
- --milestone-badge-border
- --milestone-badge-glow

### New CSS rules in feed-view.css

- .evt--milestone -- background wash
- .evt--milestone::before -- top accent stripe
- .badge-milestone -- badge styling with glow
- .badge-milestone::after -- shimmer animation
- .evt--ghost.evt--milestone -- reduced treatment overrides
- @keyframes badge-shimmer
- @media (prefers-reduced-motion: reduce) -- disables shimmer

### New badge class

.badge-milestone replaces .badge-sharing / .badge-lowkey / .badge-ghost on milestone cards. Typography and sizing match the existing badge classes (0.52rem, 700 weight, uppercase, pill radius).

---

## JS Implementation

### Where the class is applied

In js/feed-event.js renderFeedEvent(), after determining the contextKey:

1. Check if contextKey is in the milestone set (first_ever, comeback_big, comeback_small, streak_7, streak_15, streak_25, streak_full_month).
2. If yes, add .evt--milestone to the card element.
3. Replace the tier badge with a milestone badge. The badge text is derived from a contextKey-to-label map.

### The milestone context set

Define as a constant in feed-event.js:

MILESTONE_CONTEXTS: first_ever, comeback_big, comeback_small, streak_7, streak_15, streak_25, streak_full_month

MILESTONE_LABELS map:
- first_ever -> "day one"
- comeback_big -> "comeback"
- comeback_small -> "comeback"
- streak_7 -> "7-day streak"
- streak_15 -> "15-day streak"
- streak_25 -> "25-day streak"
- streak_full_month -> "perfect month"

### For persisted events

The contextKey is already stored on the event doc at write time. The renderer reads it directly. No additional Firestore reads needed.

### For legacy fallback events

Legacy events (synthesized from log docs for users without events collection) compute contextKey at render time via computeSignal(). Same check applies.

---

## What This Does NOT Change

- No new event types. Milestones are not separate events. They are a visual treatment on existing burst/diary events.
- No new Firestore writes. The contextKey is already written at burst time.
- No new copy. The existing copy system already has milestone-specific variants for every context. The visual treatment just makes the card look different before you read the words.
- No changes to the copy selection logic, debounce model, or event persistence.
- The left border color stays the tier color (red for Sharing, teal for Low key, hairline for Ghost). Only the badge changes to the gold milestone treatment.

---

## Out of Scope

- Perfect week milestone (new context key, separate spec)
- Month setup event (new event type, separate spec)
- Standalone milestone cards (rejected in FEED_EVENT_SPEC.md, milestones are absorbed by the context system)
- Milestone treatment on diary events (diary events don't have streak/comeback contexts)

---

*Spec written May 2026. Companion to FEED_EVENT_SPEC.md and FEED_EVENTS_PERSISTENCE_SPEC.md.*
