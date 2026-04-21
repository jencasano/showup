# Following Tab -- Feed View Spec

## Overview

The Feed view is a chronological stream of activity from people you follow. It is one of two views in the Following tab, toggled by the pill switcher (People / Feed). The Feed is the default view.

The feed is **event-driven and person-scoped per day.** Each person gets one card per calendar day. That card upgrades or downgrades in real time as they log, write, remove, or update.

---

## Feed Item Types

There are two types of items in the feed:

### 1. Day Card
One per person per day. Represents everything that person did on that day -- logging and/or diary. The card's richness scales with what exists.

### 2. Milestone Card
A lightweight system card generated when a followed user hits a notable moment: first day ever, comeback after absence, or a streak threshold. Milestones are distinct from day cards -- smaller, no zones, celebratory styling with a coral left accent. They slot into the feed chronologically.

Milestone triggers (same thresholds as signal copy):
- First day ever logging
- Comeback after 7+ days absent
- Comeback after 30+ days absent
- 7-day streak
- 15-day streak
- 25-day streak

---

## Feed Ordering

Cards are ordered by **last updated**, most recent first. A day card's last updated time is the most recent write across both the log and diary entry for that day.

When a card is updated (log added, diary written, log removed, diary removed), it re-sorts to the top of the feed.

---

## Day Card Structure

Every day card has two zones: **calendar zone** (top) and **diary zone** (bottom), separated by a faint divider. Both zones always render -- neither disappears silently. What they show depends on the current state and the user's privacy tiers.

### The Four States

| Log exists | Diary exists | Calendar zone | Diary zone |
|---|---|---|---|
| Yes | Yes | Full chips + 7-day strip | Full note + photo |
| Yes | No | Full chips + 7-day strip | Zone not shown (omitted silently -- nothing to say) |
| No | Yes | Changed message | Full note + photo |
| No | No | Card removed from feed entirely | -- |

### The Changed Message (calendar zone)
When a log existed and was removed, but a diary entry still exists, the calendar zone is replaced with a short human message. This prevents the card from looking like a deletion to viewers who already saw it. Copy variants (randomize from pool):

- "Plans shifted. The day's still happening."
- "Something changed. The rest remains."
- "Logged something earlier. It's gone now."
- "The day looked different this morning."

### The Changed Message (diary zone)
When a diary entry existed and was removed, but a log still exists, the diary zone shows a short message instead. Copy variants:

- "Wrote something earlier. It's gone now."
- "Had something to say. Changed their mind."
- "There was an entry. It didn't stay."

---

## Privacy Tiers in the Feed

Privacy tiers apply per zone independently, exactly as defined in FOLLOWING_SPEC.md. A card appears in the feed as long as the user is not Private.

### Sharing
Full content in both zones. Chips, 7-day strip, diary note, photo.

### Followers
Viewer always follows them, so full content shown -- same as Sharing from the viewer's perspective in the feed.

### Low key
Both zones show signal copy. No chips, no strip, no diary note or photo.

**Calendar zone:** calendarHeadline from computeSignal.
**Diary zone:** diaryHeadline from computeSignal.

Low key copy is **about the person** -- warm, observational, written as if someone is watching them with quiet admiration. The subject is the star.

> "Lulu has been incredibly consistent this month."
> "Something's taking shape for Lulu."

### Ghost
Both zones show ghost treatment. The card still appears in the feed -- Ghost is a privacy tier, not an absence. The user is active; they just don't want to show what.

Ghost copy is **about the absence, not the person.** The copy acknowledges that something happened while keeping the door fully closed. Nobody is named in the copy. The feed itself is speaking.

**Calendar zone ghost copy** (randomize from pool):
- "Showed up today. Keeping it close."
- "Something got done. That's all we know."
- "They were here. The details are theirs."
- "Checked in quietly."

**Diary zone ghost copy** (randomize from pool):
- "Wrote something. Not for sharing."
- "Something's on their mind. They're keeping it."
- "There's an entry. It stays private."
- "Words happened. They're not ours to read."

### The key distinction between Low key and Ghost copy

| | Low key | Ghost |
|---|---|---|
| Subject | The person | The absence |
| Tone | Warm, observational, cinematic | Closed door, neutral, the feed speaking |
| Names used | Yes -- "{firstName} is building something." | No -- "Something got done." |
| Viewer feeling | Quiet admiration | Respectful distance |

### Ghost per-zone
Ghost can apply to calendar only, diary only, or both -- independently. When only one zone is Ghost, the other renders normally per its own tier.

**Cal = Ghost, Diary = Sharing:** Calendar zone shows ghost copy. Diary zone shows full note + photo.
**Cal = Sharing, Diary = Ghost:** Calendar zone shows full chips + strip. Diary zone shows ghost copy.
**Cal = Ghost, Diary = Ghost:** Both zones show ghost copy. Card is rendered at reduced opacity (55%).

### Private
User does not appear in the feed at all. Not discoverable.

---

## Per-Zone Ghost Copy -- When to Show

Ghost copy only renders when the user actually has activity that day. A Ghost user who has not logged and has no diary entry does not appear in the feed at all. The card appearing is itself the signal that something happened.

---

## Real-time Behavior

The feed is driven by live Firestore snapshots (same onSnapshot pattern as People view). When any of the following happen, the affected card updates and re-sorts to the top of the feed:

- User logs an activity
- User removes a log
- User writes a diary entry
- User removes a diary entry

The card always reflects current state. No stale card content.

---

## What the Feed is NOT

- Not a notification system
- Not a ticker of every individual action
- Not a duplicate of the People view

The feed is a quiet, human-paced stream of meaningful moments. One card per person per day, upgraded as the day unfolds.

---

## Copy Storage

All ghost and changed-message copy variants live in `data/signal-copy.json` alongside existing signal copy keys. Ghost calendar keys: `ghost_cal_1` through `ghost_cal_4`. Ghost diary keys: `ghost_diary_1` through `ghost_diary_4`. Changed calendar keys: `changed_cal_1` through `changed_cal_4`. Changed diary keys: `changed_diary_1` through `changed_diary_3`.

Selection is random at render time per card, seeded by uid + date so the same card shows the same copy to all viewers on the same day.

---

## Data Requirements

### Existing (already available)
- `logsCache` -- log doc per uid, marks per activity
- `userCache` -- user doc per uid, privacy settings, decoration
- `diaryCache` -- latest diary entry per uid (already fetched in tracker-following.js)

### New (needed for feed)
- **Per-day diary entry** -- diaryCache currently stores only the latest entry across all time. Feed needs the entry for the specific day (yearMonth-DD). Fetch strategy: on feed render, fetch diary entry for today's date per followed uid. Cache by uid + date.
- **`lastUpdated` timestamp** -- needed for feed sort order. Derive from Firestore document update metadata on the log doc and diary entry doc. Compare both, use the more recent. No schema change required for v1.
- **`tracedDays`** -- future: array on user doc tracking days where activity existed and was fully removed. Used to suppress "ghost of a card" for viewers who never saw the original. Not required for v1.

---

*Spec written April 2026. Companion to FOLLOWING_SPEC.md.*
