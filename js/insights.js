// ─── insights.js ─────────────────────────────────────────
// Generates contextual insight messages from habit stats.
// Returns { topInsight, habitInsights } where:
//   topInsight   — { emoji, message } | null  (shown above the bars)
//   habitInsights — { [habitName]: { emoji, message } }  (shown inline)

/**
 * @param {object[]} habitStats  — from getUserStats / computeStatsFromEntry
 * @param {number}   daysLeftInWeek  — 0 (Sunday) … 6 (Monday)
 */
export function generateInsights(habitStats, daysLeftInWeek) {
  if (!habitStats.length) return { topInsight: null, habitInsights: {} };

  const habitInsights = {};
  const flags = {   // used to pick the single top-level insight
    perfectWeek: false,
    allSlacking: false,
    overachieverCount: 0,
  };

  // How urgent is the end-of-week nudge?
  // daysLeftInWeek: 0 = today IS the last day (Sunday), 1 = one day left, etc.
  const endOfWeekUrgent = daysLeftInWeek <= 1;  // Sun or Sat
  const endOfWeekSoon   = daysLeftInWeek <= 2;  // also Fri

  let allDone = true;
  let allZero = true;

  for (const h of habitStats) {
    const { name, cadence, thisWeekLogged, thisWeekTarget, consecutiveDays, weeklyRate } = h;
    const isDaily = cadence >= 7;
    const needed  = Math.max(0, thisWeekTarget - thisWeekLogged);
    const over    = thisWeekLogged - thisWeekTarget;  // how many above target

    if (weeklyRate < 100) allDone = false;
    if (thisWeekLogged > 0) allZero = false;

    let insight = null;

    // ── Overachiever: logged more than cadence this week ────
    if (over > 0) {
      flags.overachieverCount++;
      if (isDaily) {
        insight = { emoji: "🌟", message: `Perfect daily streak this week — you're on fire!` };
      } else {
        insight = { emoji: "🌟", message: `${thisWeekLogged} times this week — you committed to ${thisWeekTarget}×. Overachiever!` };
      }
    }

    // ── Consecutive days bonus (regardless of cadence) ──────
    else if (consecutiveDays >= 3 && cadence < 7) {
      // Extra credit for daily consistency on a low-cadence habit
      insight = { emoji: "🔥", message: `${consecutiveDays} days in a row — way beyond your ${cadence}×/wk goal. Love it!` };
    }

    // ── On track, target already met ────────────────────────
    else if (weeklyRate === 100) {
      if (endOfWeekSoon) {
        insight = { emoji: "✅", message: `Week target done! Rest easy — you earned it.` };
      } else {
        insight = { emoji: "✅", message: `Weekly goal nailed early. Keep the momentum!` };
      }
    }

    // ── On track, making good progress ──────────────────────
    else if (weeklyRate >= 50 && needed > 0) {
      if (endOfWeekUrgent) {
        insight = { emoji: "⚡", message: `${needed} more to go and today's the last day. You've got this!` };
      } else if (endOfWeekSoon) {
        insight = { emoji: "💪", message: `${needed} more to hit your ${thisWeekTarget}× goal — almost there!` };
      }
      // else: good progress, no need to say anything mid-week
    }

    // ── Slacking: nothing logged and time is running out ────
    else if (thisWeekLogged === 0) {
      if (endOfWeekUrgent) {
        if (isDaily) {
          insight = { emoji: "😬", message: `Last day of the week and still 0 for ${name}. Hey, you're not weak, are you?` };
        } else {
          insight = { emoji: "😬", message: `Not a single ${name} logged this week. Last chance — don't let yourself down!` };
        }
      } else if (endOfWeekSoon) {
        insight = { emoji: "👀", message: `Nothing logged yet this week. Clock's ticking...` };
      }
      // early week: no nudge yet, too early
    }

    // ── Falling behind with time pressure ───────────────────
    else if (weeklyRate < 50 && endOfWeekSoon && needed > 0) {
      if (endOfWeekUrgent) {
        insight = { emoji: "🚨", message: `Need ${needed} more today to hit ${thisWeekTarget}× — make it count!` };
      } else {
        insight = { emoji: "😅", message: `${needed} left for the week with only a couple of days left. Hustle!` };
      }
    }

    if (insight) habitInsights[name] = insight;
  }

  // ── Top-level insight (one per card) ────────────────────
  let topInsight = null;

  const allHabitsComplete = habitStats.every(h => h.weeklyRate >= 100);
  const allHabitsZero     = habitStats.every(h => h.thisWeekLogged === 0);
  const overachievedAll   = habitStats.every(h => h.thisWeekLogged >= h.thisWeekTarget) && flags.overachieverCount > 0;

  if (allHabitsComplete && endOfWeekSoon) {
    topInsight = { emoji: "🎉", message: "Perfect week! Every single habit hit. You absolutely showed up." };
  } else if (allHabitsComplete) {
    topInsight = { emoji: "🏆", message: "All habits done for the week — and it's not even over yet!" };
  } else if (allHabitsZero && endOfWeekUrgent) {
    topInsight = { emoji: "💀", message: "Last day of the week and nothing logged. No more excuses — go!" };
  } else if (allHabitsZero && endOfWeekSoon) {
    topInsight = { emoji: "😶", message: "Week's almost done and the board is empty. This isn't you." };
  } else if (flags.overachieverCount === habitStats.length) {
    topInsight = { emoji: "🚀", message: "You went above and beyond on every habit this week. Legendary!" };
  }

  return { topInsight, habitInsights };
}

/**
 * How many days are left in the week (Mon–Sun) for the given date?
 * Returns 0 if the date is a Sunday (last day), 6 if it is a Monday.
 */
export function getDaysLeftInWeek(referenceDate = new Date()) {
  const day = referenceDate.getDay(); // 0=Sun, 1=Mon … 6=Sat
  // Week ends on Sunday. Days left = days until Sunday.
  if (day === 0) return 0;         // today IS Sunday
  return 7 - day;                  // Mon=6, Tue=5, … Sat=1
}
