# Feed Signal: Perfect Week

> A new context key in the signal system that recognizes when every activity
> hit its cadence target for a complete Monday-to-Sunday week.
> Companion to MILESTONE_CARD_SPEC.md and FEED_EVENT_SPEC.md.

---

## Overview

A perfect week means every activity the user is tracking met or exceeded its
cadence target across a complete Monday-to-Sunday week. This is harder than a
streak (which just means "something was logged each day") because it requires
every individual target to be hit. It is rare and meaningful.

Example: Jeni tracks Workout (Daily/7x), 8hr Sleep (Daily/7x), and No Rice
(4x/wk). A perfect week means Workout logged 7 days, 8hr Sleep logged 7 days,
and No Rice logged at least 4 days within the same Mon-Sun window.

---

## When It Fires

The perfect week context fires on the log event (burst card) that completes the
week. If someone logs their last activity on Sunday and that tips every cadence
over the target, that Sunday burst gets the "perfect week" badge.

If the current week is not yet complete (today is not Sunday), the check looks
at the most recently completed Mon-Sun week. If today IS Sunday and the user
just logged, the check includes the current week.

If the user never completes the week (misses a target), nothing fires. Clean
cause and effect.

---

## Priority in the Signal Cascade

Perfect week slots between streak_15 and streak_7 in the priority order:

```
first_ever
comeback_big
comeback_small
backfill
streak_full_month
streak_25
streak_15
perfect_week        <-- new
streak_7
streak_3
default
```

Rationale: a 15-day streak is a bigger deal than a single perfect week because
it spans more time. But a perfect week is harder than a 7-day streak because
it requires every target met, not just presence. If someone has both a perfect
week AND a 15-day streak, streak_15 wins.

---

## Modularization

The week boundary math and per-activity cadence checking should live in a new
module: `js/signal-week.js`. This keeps following-signals.js focused on the
cascade logic while the "did this week hit all targets" computation is isolated
and testable.

### js/signal-week.js

Exports one function:

`checkPerfectWeek(logEntry, yearMonth)` -> boolean

The function:

1. Reads logEntry.activities (array of activity names or objects), logEntry.cadences
   (array of numbers, parallel to activities), and logEntry.marks (object keyed
   by activity name, values are arrays of day numbers).

2. Determines which Mon-Sun week to check:
   - Build a Date from yearMonth + today's day number to find the current
     day of the week.
   - If today is Sunday: check the current week (Mon = today - 6 through
     Sun = today).
   - Otherwise: check the most recently completed week. Find the last Sunday
     that has passed, then Mon = that Sunday - 6.
   - The week must fall entirely within the current yearMonth. If the Monday
     falls in the previous month, skip the check (return false). Cross-month
     weeks are not evaluated.

3. For each activity, count how many marks fall within the week's day range
   (Monday day number through Sunday day number, inclusive).

4. Compare each activity's count against its cadence target. If every activity
   meets or exceeds its cadence, return true. Otherwise false.

5. Edge cases:
   - If logEntry has no activities or no cadences, return false.
   - If activities and cadences arrays have different lengths, use the shorter
     length (defensive).
   - If there are zero activities, return false.
   - If the week range hasn't started yet (e.g. month just began and no full
     week has passed), return false.

### Integration in following-signals.js

Import `checkPerfectWeek` from `./signal-week.js`. Call it inside
`computeSignal()` after the streak_15 check and before streak_7:

```
const isPerfectWeek = checkPerfectWeek(logEntry, yearMonth);
```

where yearMonth comes from logEntry.yearMonth or is derived from the current
date.

In the cascade:

```
else if (streak >= 15)       { key = "streak_15"; contextKey = "streak_15"; }
else if (isPerfectWeek)      { key = "streak_7";  contextKey = "perfect_week"; }
else if (streak >= 7)        { key = "streak_7";  contextKey = "streak_7"; }
```

Note: the People-view `key` maps to "streak_7" (for the old copy lookup) but
the `contextKey` is "perfect_week" (for the feed copy and milestone treatment).

---

## Milestone Treatment

Perfect week earns the milestone visual treatment (wash + stripe + glowing badge).

Add to MILESTONE_CONTEXTS and MILESTONE_LABELS in js/feed-event.js:

```
MILESTONE_CONTEXTS: add "perfect_week"
MILESTONE_LABELS: perfect_week -> "perfect week"
```

---

## Copy

New keys in data/signal-copy.json following the established pattern:
`feed_{tier}_log_perfect_week_{variant}`

### Sharing (4 variants)

```
feed_sharing_log_perfect_week_1: "{firstName} hit every target this week. Every single one. {nudge}Have you?{/nudge}"
feed_sharing_log_perfect_week_2: "{firstName} just closed a perfect week. Every activity, every target, met. {nudge}That's rare.{/nudge}"
feed_sharing_log_perfect_week_3: "{firstName} didn't miss a single target this week. {streak}All activities. All cadences. Done.{/streak}"
feed_sharing_log_perfect_week_4: "{firstName} ran the table this week. {streak}Every target hit.{/streak} {nudge}When's the last time you could say that?{/nudge}"
```

### Low key (3 variants)

```
feed_lowkey_log_perfect_week_1: "{firstName} had a perfect week. Quietly."
feed_lowkey_log_perfect_week_2: "Everything {firstName} set out to do this week? Done."
feed_lowkey_log_perfect_week_3: "{firstName} didn't miss anything this week. Not one thing. {nudge}Can you say the same?{/nudge}"
```

### Ghost (3 variants)

```
feed_ghost_log_perfect_week_1: "{firstName} closed a perfect week. The details stay theirs."
feed_ghost_log_perfect_week_2: "Every target met. Quietly. {firstName} knows what they did."
feed_ghost_log_perfect_week_3: "A perfect week happened for {firstName}. We don't know the targets. But they were all hit."
```

### People-view copy (old format)

Add a People-view entry for the key lookup fallback:

```
streak_7_calendar already exists and will be used via key = "streak_7"
```

No new People-view keys needed since perfect_week maps to the streak_7 key for
the old format.

---

## Firestore

No new Firestore writes. The contextKey "perfect_week" is computed at burst
write time via computeSignal() and stored in the event doc's contextKey field,
same as all other context keys. The existing event-write.js flow handles this
automatically.

---

## Implementation Checklist

1. Create js/signal-week.js with checkPerfectWeek(logEntry, yearMonth)
2. In js/following-signals.js, import checkPerfectWeek and add the perfect_week
   check in the cascade between streak_15 and streak_7
3. In js/feed-event.js, add "perfect_week" to MILESTONE_CONTEXTS and
   MILESTONE_LABELS (label: "perfect week")
4. Add 10 copy variants to data/signal-copy.json (4 sharing, 3 lowkey, 3 ghost)
5. No CSS changes needed (milestone treatment already handles it)
6. No Firestore changes needed (contextKey persisted via existing event-write flow)

---

## What This Does NOT Do

- No per-activity milestones ("30 days of Workout"). That is a separate feature.
- No cross-month week evaluation. If a Mon-Sun week spans two months, it is
  not checked.
- No retroactive perfect week detection for past weeks. Only the most recently
  completed week (or current week if today is Sunday) is evaluated.
- No changes to the People view. Perfect week only surfaces through the feed
  event copy and milestone badge.

---

*Spec written May 2026. Companion to MILESTONE_CARD_SPEC.md and FEED_EVENT_SPEC.md.*
