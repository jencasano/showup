# Following Tab -- Feed Event Spec

> This document supersedes the card-based feed model in FEED_SPEC.md.
> FEED_EVENT_SPEC.md is the authoritative spec for the feed going forward.

---

## Why We Changed

The original feed built one "day card" per person per day across a rolling 3-day window. In practice this caused confusion -- a single user could appear multiple times in the feed (once per day they had activity), cards looked nearly identical, and real-time re-sorting made the feed feel unstable.

The root problem: a card implies a stable snapshot. showup. is a living log. People write into it throughout the day and across multiple days. Cards kept mutating and the experience was disorienting.

**The new model: the unit is the event, not the day.**

The feed is a chronological stream of things that happened. Each meaningful write generates one event. Events are small, human, and distinct. The feed answers: "what did the people I follow DO?" -- not "what does their day look like right now?"

---

## Event Types

There are two event types a user can generate:

1. **Logged an activity** -- user marked one or more activities for any day
2. **Wrote a diary entry** -- user created a diary entry for any day

Diary edits do NOT generate a new event. Instead, the existing event gets a quiet inline `edited` flag next to the timestamp. No new card, no re-sort.

---

## "Logging in one go" -- Debounce Model

The tracker has no batch save or session concept. Each activity tap fires its own Firestore write. If a user taps 5 activities in 30 seconds, that is 5 writes in rapid succession.

To prevent event flooding, the feed uses a **debounce window of 10 seconds** on log writes:

- Each write to the log doc resets a 10-second timer.
- When the timer expires (no more writes), one event fires reflecting the full current state of the log.
- If more writes come in during the window, the timer resets and the event has not fired yet.

This means a burst of activity taps produces exactly one event -- showing all activities logged in that session. This is what we mean by "logging in one go."

The diary has no debounce -- a diary save is a deliberate single action and fires its own event immediately.

---

## Event Anatomy

Each feed event has the following parts:

1. **Action line** -- the main copy. Human, warm, tier-specific. Streak and comeback context woven in where earned.
2. **Date context line** -- small, muted. When the activity was for and when the event fired.
3. **Links row** -- Sharing tier only. "View Calendar" link for log events. "Read entry" link for diary events.
4. **Edited flag** -- appends `· edited` to the date context line when a diary entry is updated after the event fired. No new event generated.

### Date context line format

- For today: `today at 10:15am`
- For yesterday: `yesterday at 10:15am`
- For any other day: `Apr 14 at 10:15am`

Ghost tier -- date context folds into the copy itself. No separate date line.

### Edited flag

When a diary entry is edited, the date context line becomes:
`today at 10:15am · edited`

No new event is created. No re-sort.

---

## Activity Name Display (Sharing tier only)

Activity names are shown inline in the action line using Fraunces italic 600 weight. No pills. Smart collapsing prevents the line from becoming a grocery list.

| Count | Format |
|---|---|
| 1 | "logged *Wim Hof Pushups*" |
| 2 | "logged *Wim Hof Pushups* and *No Don Papa*" |
| 3 | "logged *Wim Hof*, *Cold Shower*, and *Running*" |
| 4+ | "logged *Wim Hof*, *Cold Shower*, and 3 more" |

Scales automatically regardless of how many activities are allowed in future.

---

## Streak Model

Streaks are tracked **per person overall** -- not per activity. A streak means they logged SOMETHING every day, regardless of which activity. This respects the weekly cadence model where some activities are not intended to be done daily.

Streak commentary is always clearly separated from the activity name in the copy. The activity is what they did today. The streak is about the person overall.

Example: "Neithan logged *Wim Hof Pushups*. Something every single day this month."
Not: "Neithan logged *Wim Hof Pushups* every single day this month."

---

## Event Context

Both Sharing and Low key copy varies based on context computed at render time from log data via `computeSignal()` in `following-signals.js`. Context is evaluated top to bottom -- first match wins.

| Context | Trigger |
|---|---|
| `first_ever` | First day the user has ever logged |
| `comeback_big` | Last log was 30+ days ago |
| `comeback_small` | Last log was 7-29 days ago |
| `streak_full_month` | Every single day of the current month so far |
| `streak_25` | 25+ consecutive logged days |
| `streak_15` | 15+ consecutive logged days |
| `streak_7` | 7+ consecutive logged days |
| `streak_3` | 3+ consecutive logged days |
| `backfill` | Logged for a past day, not today |
| `default` | None of the above |

**Milestones are absorbed by this context system.** There is no separate milestone card type. First day ever, comeback events, and streak thresholds all surface through the event copy, not separate cards.

---

## Privacy Tiers in the Feed

Privacy tiers apply per zone (calendar and diary independently) as defined in FOLLOWING_SPEC.md. The tier at event render time determines the copy.

### Tier personalities

**Sharing** -- literal, specific, warm. Names the person. Names the activity (Fraunces italic 600). Streak and comeback context surfaced as a second thought after the activity. Occasionally turns to face the viewer directly with a nudge. Feels like a friend texting you.

**Followers** -- viewer is always a follower, so full content is shown. Identical to Sharing from the viewer's perspective.

**Low key** -- insight, not action. Names the person. Never names the activity. Surfaces the pattern -- streak, momentum, comeback -- as data reframed as a human observation. Feels like someone who has been quietly paying attention from across the room.

**Ghost** -- the feed noticing an absence. No name ever. No action, no insight. Just the faint signal that something happened somewhere. Poetic, slightly haunting. A closed door that is somehow still beautiful.

**Private** -- user does not appear in the feed at all.

### Nudges

Certain event contexts include a viewer-facing nudge woven into the action line -- a line that turns to face the person reading the feed. Nudges appear in Sharing and Low key tiers only. Ghost never gets a nudge.

Nudges are not on every event. They appear where the context earns it: streaks, comebacks, first evers. They are italic, coral-colored (Sharing) or part of the flow (Low key). They whisper -- they do not shout.

---

## Copy System

All copy lives in `data/signal-copy.json`. New keys are added for feed events alongside existing signal copy keys.

Key naming convention: `feed_{tier}_{eventtype}_{context}_{variant}` e.g. `feed_sharing_log_streak7_1`

Variants are randomized at render time, seeded by uid + date so the same event shows the same copy to all viewers on the same day.

---

## THE COPY SET

### SHARING

#### Logged -- default
- "{firstName} logged {activities}."
- "{firstName} just put {activities} on the board."
- "{firstName} got {activities} done today."
- "{firstName} marked {activities}. Done."

#### Logged -- streak_3
- "{firstName} logged {activities}. They've logged something 3 days in a row."
- "{firstName} logged {activities}. Something every day for 3 days straight."

#### Logged -- streak_7
- "{firstName} logged {activities}. They've logged something every day this week."
- "{firstName} logged {activities}. Something every single day this week."
- "{firstName} logged {activities}. Seven days of showing up. Every day. Have you shown up today?"

#### Logged -- streak_15
- "{firstName} logged {activities}. Something logged every day for 15 days straight."
- "{firstName} logged {activities}. They've logged something every day for half a month."
- "{firstName} logged {activities}. Fifteen days of showing up every day. Have you done anything today?"

#### Logged -- streak_25
- "{firstName} logged {activities}. They've logged something every day for 25 days."
- "{firstName} logged {activities}. Something every day for 25 days. They're not stopping. Are you?"
- "{firstName} logged {activities}. Twenty-five days of something every single day. Join them in showing up."

#### Logged -- streak_full_month
- "{firstName} logged {activities}. They've logged something every single day this month."
- "{firstName} logged {activities}. Something logged every day this month. Every one. Have you shown up today?"
- "{firstName} logged {activities}. A perfect month so far. Every single day. Can you say the same?"

#### Logged -- first_ever
- "{firstName} just logged {activities} for the first time. Day one."
- "{firstName} started. First log: {activities}. Everyone starts somewhere."
- "First day for {firstName}. They logged {activities}. Have you started yours?"

#### Logged -- comeback_small
- "{firstName} logged {activities}. They found their way back."
- "{firstName} is back. Picked up {activities} right where they left off."
- "A little time away, then {activities}. {firstName} is back. Coming back is the hardest part."

#### Logged -- comeback_big
- "{firstName} logged {activities}. After a long time away. They're back."
- "After a long silence, {firstName} logged {activities}. Welcome back."
- "{firstName} broke a long quiet with {activities}. Good to see them. Is there something you've been putting off?"

#### Logged -- backfill
- "{firstName} logged {activities} for {date}."
- "{firstName} filled in {activities} for {date}."
- "{firstName} went back and marked {activities} for {date}."
- "{firstName} didn't let {date} go unlogged. {activities}."

#### Wrote diary -- today
- "{firstName} wrote in their diary today."
- "{firstName} had something to say about today."
- "{firstName} put today into words."
- "{firstName} left an entry. Go read it."
- "{firstName} closed today with words."
- "{firstName} wrote something worth reading."

#### Wrote diary -- past day
- "{firstName} went back and wrote about {date}."
- "{firstName} had more to say about {date}."
- "{firstName} put {date} into words."
- "{firstName} didn't let {date} pass without words."

---

### LOW KEY
*(no activity names ever)*

#### Logged -- default
- "{firstName} showed up today."
- "{firstName} put something in today."
- "{firstName} was here today."
- "Something got done in {firstName}'s world."

#### Logged -- streak_3
- "{firstName} has been here 3 days in a row."
- "3 days straight for {firstName}."

#### Logged -- streak_7
- "{firstName} hasn't missed a day this week. Join them in showing up."
- "7 days in a row for {firstName}."
- "{firstName} keeps showing up. Every day this week."

#### Logged -- streak_15
- "{firstName} has been showing up every day for 15 days."
- "15 days and {firstName} hasn't stopped."
- "Half a month of showing up for {firstName}. Have you done anything today?"

#### Logged -- streak_25
- "{firstName} hasn't missed a day in 25 days."
- "25 days in a row for {firstName}. Still going."
- "{firstName} keeps showing up. 25 days now. Quietly. Are you keeping up?"

#### Logged -- streak_full_month
- "{firstName} hasn't missed a single day this month."
- "A perfect month so far for {firstName}."
- "Not one missed day for {firstName} this month. Not one. Have you shown up today?"
- "{firstName} has shown up every single day this month."

#### Logged -- first_ever
- "{firstName} just started."
- "Day one for {firstName}."
- "Something's beginning for {firstName}."

#### Logged -- comeback_small
- "{firstName} came back today."
- "{firstName} returned. That's the whole story."
- "{firstName} picked it back up. Coming back is the hardest part."

#### Logged -- comeback_big
- "{firstName} is back."
- "{firstName} came back today. It's been a while."
- "{firstName} returned after a long time away."
- "{firstName} broke a long silence today. Is there something you've been putting off?"

#### Logged -- backfill
- "{firstName} circled back and filled something in."
- "{firstName} went back and tidied something up."
- "{firstName} caught up on something."

#### Wrote diary -- today
- "{firstName} had something on their mind today."
- "Today meant something to {firstName}."
- "{firstName} is sitting with something."
- "Something's going on in {firstName}'s world. They wrote about it."
- "{firstName} processed something today. In writing."

#### Wrote diary -- past day
- "{firstName} wasn't done with {date} yet."
- "{date} still had something to say to {firstName}."
- "{firstName} went back to {date}. Something was left unfinished."

---

### GHOST
*(no name ever -- the feed speaking to itself)*

#### Logged -- default
- "Someone showed up today. The details are theirs."
- "Something got logged. We're not saying what."
- "The work happened. That's all this feed knows."
- "A quiet one checked in today."
- "Something got done. Privately."
- "Someone put something on the board. Quietly."

#### Logged -- streak_full_month
- "Someone hasn't missed a single day this month."
- "A perfect month. Quietly."
- "Every day this month. Someone out there is serious."
- "Not one missed day. We don't know who. But they know."

#### Logged -- first_ever
- "Someone just started. Day one."
- "A first day happened. Quietly."
- "Something began today. We don't know what."

#### Logged -- comeback_small
- "Someone came back today. Just like that."
- "Something that went quiet started again."
- "Someone picked it back up."
- "A quiet one returned."

#### Logged -- comeback_big
- "Someone came back today. It's been a while."
- "A long silence broke today. Quietly."
- "The silence broke. Just like that."
- "Someone returned after a long time away. No announcement. Just showed up."
- "Something that had gone very quiet started again today."

#### Logged -- backfill
- "Someone went back and filled something in."
- "A past day got its due."
- "Something from {date} got logged. Privately."
- "Someone circled back. No further details."

#### Wrote diary -- today
- "Someone wrote something today. It's not for us."
- "Words happened. The door stays closed."
- "An entry exists. That's all we know."
- "Someone sat with today and wrote. We'll never know what."
- "Something got put into words. Not our words to read."
- "A page filled up somewhere. Quietly."

#### Wrote diary -- past day
- "{date} got words. Private ones."
- "Someone went back to {date} and wrote something."
- "Something from {date} got written down. It stays there."

---

## Visual Design

### Event card anatomy

```
[ Avatar ] [ Name ]                    [ TIER BADGE ]
           [ timestamp · edited? ]

Action line copy. Nudge copy if applicable.

📅 View Calendar   or   📓 Read entry
```

### Typography

- **Name:** Inter 600, var(--text)
- **Timestamp:** Inter 400, var(--text-faint)
- **Action line:** Inter 400, var(--text), 0.86rem, line-height 1.55
- **Activity names in action line:** Fraunces italic 600, same color as action line
- **Nudge:** Inter 400 italic, var(--color-primary) coral
- **Ghost copy:** Fraunces italic 400, var(--text-muted)
- **Links:** Inter 500, amber for diary, teal for calendar

### Tier left border

- Sharing: 3px solid var(--color-primary)
- Low key: 3px solid var(--color-teal)
- Ghost: 3px solid var(--border), opacity 0.75

### Tier badge

- SHARING: coral background tint, coral text
- LOW KEY: teal background tint, teal text
- GHOST: subtle background, faint text

### Ghost avatar

Ghost events show a "?" avatar with a muted background. No real name shown -- name field reads "Someone" in faint text.

---

## Implementation Notes

### Debounce

Feed event generation is debounced on log writes with a 10-second quiet window. The event reflects the full state of the log doc after the burst settles. This is handled at the feed listener level, not at the Firestore write level -- no changes to the existing log write path needed.

### Existing infrastructure reused

- `computeSignal()` in `following-signals.js` -- streak and comeback detection. Reused as-is.
- `pickCopy()` in `following-signals.js` -- seeded random copy selection. Reused as-is.
- `onSnapshot` listeners in `tracker-following.js` -- already fire on log and diary updates. Debounce layer sits on top.
- `data/signal-copy.json` -- new feed copy keys added alongside existing keys.

### New infrastructure needed

- Feed event renderer (replaces `feed-card.js` or heavily refactors it)
- Debounce manager per uid (tracks pending event timer per followed user)
- Activity name collapsing function (1 / 2 / 3 / n+more display logic)
- Context detection extended to include `streak_full_month` (not currently in `computeSignal`)

---

*Spec written April 2026. Supersedes FEED_SPEC.md. Companion to FOLLOWING_SPEC.md.* 🪨
