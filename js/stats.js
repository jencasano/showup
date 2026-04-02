import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getCurrentYearMonth, getPrevYearMonth, getDaysInMonth } from "./utils.js";

// ─── Helpers ──────────────────────────────────────────────

// Returns the Monday of the ISO week containing a given Date
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day); // Monday = start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Given a yearMonth ("YYYY-MM") and day number, return a Date
function toDate(yearMonth, day) {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(y, m - 1, day);
}

// Per-habit: how many times was it logged in the week
// that contains `referenceDate`?
function logsInWeek(markedDays, yearMonth, referenceDate) {
  const weekStart = getWeekStart(referenceDate);
  const weekEnd   = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return markedDays.filter(d => {
    const date = toDate(yearMonth, d);
    return date >= weekStart && date <= weekEnd;
  }).length;
}

// Cadence label helper (exported so tracker.js can use it too)
export function cadenceLabel(n) {
  return n === 7 ? "Daily" : `${n}×/wk`;
}

// ─── Per-habit fulfillment rate for the month so far ─────
// Returns a 0–1 value: actual / pro-rated target
function habitFulfillmentRate(markedDays, cadence, yearMonth, lastDay) {
  const logged = markedDays.filter(d => d <= lastDay).length;
  // Pro-rate the cadence target based on how much of the month has elapsed
  const daysInMonth = getDaysInMonth(yearMonth);
  const target = Math.max(1, Math.round(cadence * (lastDay / 7)));
  return Math.min(1, logged / target);
}

// ─── Did this habit hit its weekly target? ────────────────
// Returns true if logs in the week containing `date` >= cadence
function hitWeeklyTarget(markedDays, cadence, yearMonth, date) {
  return logsInWeek(markedDays, yearMonth, date) >= cadence;
}

// ─── Weekly streak across all habits ─────────────────────
// A streak week = all habits hit their cadence that week.
// We walk back week by week from the current week.
async function calculateWeeklyStreak(userId, yearMonth, activities, cadences, marks) {
  const today = new Date();
  let streak = 0;
  let checkDate = new Date(today);

  // We'll check up to 52 weeks back to avoid infinite loops
  for (let w = 0; w < 52; w++) {
    const weekStart = getWeekStart(checkDate);
    // Figure out which yearMonth this week-start belongs to
    const ym = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}`;

    let habitMarks = marks;
    let habitActivities = activities;
    let habitCadences   = cadences;

    // If we've crossed into a different month, fetch that month's data
    if (ym !== yearMonth) {
      try {
        const snap = await getDoc(doc(db, "logs", ym, "entries", userId));
        if (!snap.exists()) break;
        const d = snap.data();
        habitActivities = d.activities || [];
        habitCadences   = d.cadences   || habitActivities.map(() => 7);
        habitMarks      = d.marks      || {};
      } catch (e) {
        break;
      }
    }

    if (habitActivities.length === 0) break;

    const allHit = habitActivities.every((activity, i) => {
      const cad       = habitCadences[i] ?? 7;
      const logged    = hitWeeklyTarget(
        habitMarks[activity] || [],
        cad,
        ym,
        checkDate
      );
      return logged;
    });

    // Current week: partial — only count if we've had enough days this week
    // for *all* habits. If it's the first iteration (current week) and not all
    // habits have hit yet, that's OK — we don't break, we just don't count it.
    if (w === 0 && !allHit) {
      // Don't break — the current week may still be in progress.
      // Move to previous week and continue checking.
      checkDate.setDate(checkDate.getDate() - 7);
      continue;
    }

    if (!allHit) break;

    streak++;
    checkDate.setDate(checkDate.getDate() - 7);
  }

  return streak;
}

// ─── Main export: getUserStats ────────────────────────────
// Returns:
//   streak           — consecutive completed weeks (all habits hit cadence)
//   doneThisMonth    — total log entries up to today
//   totalThisMonth   — days elapsed in month
//   overallRate      — 0–100, equal-weighted avg across habits
//   habitStats       — per-habit array: { name, cadence, logged, target, rate }
export async function getUserStats(userId, yearMonth) {
  try {
    const logSnap = await getDoc(doc(db, "logs", yearMonth, "entries", userId));
    if (!logSnap.exists()) return emptyStats();

    const data       = logSnap.data();
    const activities = data.activities || [];
    const cadences   = data.cadences   || activities.map(() => 7); // default daily
    const marks      = data.marks      || {};

    if (activities.length === 0) return emptyStats();

    const daysInMonth   = getDaysInMonth(yearMonth);
    const isCurrentMonth = yearMonth === getCurrentYearMonth();
    const today         = new Date();
    const lastDay       = isCurrentMonth ? today.getDate() : daysInMonth;

    // Total log entries across all habits up to today (for the legacy display)
    const doneDays = new Set();
    activities.forEach(activity => {
      (marks[activity] || []).forEach(d => { if (d <= lastDay) doneDays.add(d); });
    });

    // Per-habit stats
    const habitStats = activities.map((activity, i) => {
      const cad     = cadences[i] ?? 7;
      const logged  = (marks[activity] || []).filter(d => d <= lastDay).length;
      const target  = Math.max(1, Math.round(cad * (lastDay / 7)));
      const rate    = Math.min(100, Math.round(Math.min(1, logged / target) * 100));

      // This week's progress
      const thisWeekLogged = logsInWeek(marks[activity] || [], yearMonth, today);

      return {
        name:          activity,
        cadence:       cad,
        cadenceLabel:  cadenceLabel(cad),
        logged,
        target,
        rate,
        thisWeekLogged,
        thisWeekTarget: cad
      };
    });

    // Overall rate: equal-weighted average
    const overallRate = Math.round(
      habitStats.reduce((sum, h) => sum + h.rate, 0) / habitStats.length
    );

    // Weekly streak
    const streak = await calculateWeeklyStreak(
      userId, yearMonth, activities, cadences, marks
    );

    return {
      streak,
      doneThisMonth:  doneDays.size,
      totalThisMonth: lastDay,
      overallRate,
      habitStats
    };
  } catch (error) {
    console.error("Stats error:", error);
    return emptyStats();
  }
}

function emptyStats() {
  return {
    streak: 0,
    doneThisMonth: 0,
    totalThisMonth: 0,
    overallRate: 0,
    habitStats: []
  };
}
