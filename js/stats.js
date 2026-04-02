import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getCurrentYearMonth, getPrevYearMonth, getDaysInMonth } from "./utils.js";

// ─── Helpers ──────────────────────────────────────────────

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDate(yearMonth, day) {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function logsInWeek(markedDays, yearMonth, referenceDate) {
  const weekStart = getWeekStart(referenceDate);
  const weekEnd   = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return markedDays.filter(d => {
    const date = toDate(yearMonth, d);
    return date >= weekStart && date <= weekEnd;
  }).length;
}

export function cadenceLabel(n) {
  const cadence = Number(n);
  if (n == null || !Number.isFinite(cadence) || cadence >= 7) return "Daily";
  return `${cadence}×/wk`;
}

function hitWeeklyTarget(markedDays, cadence, yearMonth, date) {
  return logsInWeek(markedDays, yearMonth, date) >= cadence;
}

// ─── Per-habit streak: consecutive weeks this habit hit its target ───
async function calculateHabitStreak(userId, activity, cadence, yearMonth, markedDays) {
  const today = new Date();
  let streak = 0;
  let checkDate = new Date(today);

  for (let w = 0; w < 52; w++) {
    const weekStart = getWeekStart(checkDate);
    const ym = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}`;

    let marks = markedDays;

    if (ym !== yearMonth) {
      try {
        const snap = await getDoc(doc(db, "logs", ym, "entries", userId));
        if (!snap.exists()) break;
        const d = snap.data();
        const activities = d.activities || [];
        const idx = activities.indexOf(activity);
        const cadences = d.cadences || activities.map(() => 7);
        cadence = idx >= 0 ? (cadences[idx] ?? 7) : cadence;
        marks = (d.marks || {})[activity] || [];
      } catch (e) {
        break;
      }
    }

    const hit = logsInWeek(marks, ym, checkDate) >= cadence;

    // Skip current incomplete week if not yet hit — start counting from last week
    if (w === 0 && !hit) {
      checkDate.setDate(checkDate.getDate() - 7);
      continue;
    }

    if (!hit) break;

    streak++;
    checkDate.setDate(checkDate.getDate() - 7);
  }

  return streak;
}

async function calculateWeeklyStreak(userId, yearMonth, activities, cadences, marks) {
  const today = new Date();
  let streak = 0;
  let checkDate = new Date(today);

  for (let w = 0; w < 52; w++) {
    const weekStart = getWeekStart(checkDate);
    const ym = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}`;

    let habitMarks = marks;
    let habitActivities = activities;
    let habitCadences   = cadences;

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
      const cad = habitCadences[i] ?? 7;
      return hitWeeklyTarget(habitMarks[activity] || [], cad, ym, checkDate);
    });

    if (w === 0 && !allHit) {
      checkDate.setDate(checkDate.getDate() - 7);
      continue;
    }

    if (!allHit) break;

    streak++;
    checkDate.setDate(checkDate.getDate() - 7);
  }

  return streak;
}

// ─── computeStatsFromEntry ────────────────────────────────
// Synchronous — used for optimistic UI updates on toggle.
// habitStreak is not recalculated here (requires async history lookup);
// it carries over from the last full getUserStats call via the DOM.
export function computeStatsFromEntry(entry, yearMonth) {
  const activities = entry.activities || [];
  const cadences   = entry.cadences   || activities.map(() => 7);
  const marks      = entry.marks      || {};

  if (activities.length === 0) return emptyStats();

  const daysInMonth    = getDaysInMonth(yearMonth);
  const isCurrentMonth = yearMonth === getCurrentYearMonth();
  const today          = new Date();
  const lastDay        = isCurrentMonth ? today.getDate() : daysInMonth;

  const doneDays = new Set();
  activities.forEach(activity => {
    (marks[activity] || []).forEach(d => { if (d <= lastDay) doneDays.add(d); });
  });

  const habitStats = activities.map((activity, i) => {
    const cad    = cadences[i] ?? 7;
    const logged = (marks[activity] || []).filter(d => d <= lastDay).length;
    const target = Math.max(1, Math.ceil(cad * (lastDay / 7)));
    const rate   = Math.min(100, Math.round(Math.min(1, logged / target) * 100));
    const thisWeekLogged = logsInWeek(marks[activity] || [], yearMonth, today);
    const thisWeekTarget = cad;
    const weeklyRate = Math.min(100, Math.round((thisWeekLogged / thisWeekTarget) * 100));
    return {
      name: activity,
      cadence: cad,
      cadenceLabel: cadenceLabel(cad),
      logged,
      target,
      rate,
      thisWeekLogged,
      thisWeekTarget,
      weeklyRate,
      habitStreak: 0  // placeholder; real value set by getUserStats
    };
  });

  // Overall rate = average of weekly rates (consistent with the bars)
  const overallRate = Math.round(
    habitStats.reduce((sum, h) => sum + h.weeklyRate, 0) / habitStats.length
  );

  return {
    streak: 0,
    doneThisMonth:  doneDays.size,
    totalThisMonth: lastDay,
    overallRate,
    habitStats
  };
}

// ─── getUserStats ─────────────────────────────────────────
export async function getUserStats(userId, yearMonth) {
  try {
    const logSnap = await getDoc(doc(db, "logs", yearMonth, "entries", userId));
    if (!logSnap.exists()) return emptyStats();

    const data       = logSnap.data();
    const activities = data.activities || [];
    const cadences   = data.cadences   || activities.map(() => 7);
    const marks      = data.marks      || {};

    if (activities.length === 0) return emptyStats();

    const daysInMonth    = getDaysInMonth(yearMonth);
    const isCurrentMonth = yearMonth === getCurrentYearMonth();
    const today          = new Date();
    const lastDay        = isCurrentMonth ? today.getDate() : daysInMonth;

    const doneDays = new Set();
    activities.forEach(activity => {
      (marks[activity] || []).forEach(d => { if (d <= lastDay) doneDays.add(d); });
    });

    // Calculate per-habit streaks in parallel
    const habitStreaks = await Promise.all(
      activities.map((activity, i) =>
        calculateHabitStreak(userId, activity, cadences[i] ?? 7, yearMonth, marks[activity] || [])
      )
    );

    const habitStats = activities.map((activity, i) => {
      const cad    = cadences[i] ?? 7;
      const logged = (marks[activity] || []).filter(d => d <= lastDay).length;
      const target = Math.max(1, Math.ceil(cad * (lastDay / 7)));
      const rate   = Math.min(100, Math.round(Math.min(1, logged / target) * 100));
      const thisWeekLogged = logsInWeek(marks[activity] || [], yearMonth, today);
      const thisWeekTarget = cad;
      const weeklyRate = Math.min(100, Math.round((thisWeekLogged / thisWeekTarget) * 100));
      return {
        name: activity,
        cadence: cad,
        cadenceLabel: cadenceLabel(cad),
        logged,
        target,
        rate,
        thisWeekLogged,
        thisWeekTarget,
        weeklyRate,
        habitStreak: habitStreaks[i]
      };
    });

    // Overall rate = average of weekly rates (consistent with the bars)
    const overallRate = Math.round(
      habitStats.reduce((sum, h) => sum + h.weeklyRate, 0) / habitStats.length
    );

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
