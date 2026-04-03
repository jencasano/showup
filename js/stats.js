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

function getReferenceDate(yearMonth, isCurrentMonth, lastDay) {
  if (isCurrentMonth) return new Date();
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(y, m - 1, lastDay);
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

function getFullWeeksInMonth(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  const totalDays = getDaysInMonth(yearMonth);
  const weeks = [];
  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(y, m - 1, day);
    const isMonday = date.getDay() === 1;
    if (!isMonday) continue;
    const endDay = day + 6;
    if (endDay <= totalDays) {
      weeks.push({ startDay: day, endDay });
    }
  }
  return weeks;
}

function countInRange(markedDays, startDay, endDay) {
  return markedDays.filter(d => d >= startDay && d <= endDay).length;
}

function countConsecutiveDays(markedDays, yearMonth, today) {
  const todayNum = today.getDate();
  let streak = 0;
  for (let d = todayNum; d >= 1; d--) {
    if (markedDays.includes(d)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function cadenceLabel(n) {
  const cadence = Number(n);
  if (n == null || !Number.isFinite(cadence) || cadence >= 7) return "Daily";
  return `${cadence}x/wk`;
}

function hitWeeklyTarget(markedDays, cadence, yearMonth, date) {
  return logsInWeek(markedDays, yearMonth, date) >= cadence;
}

// ─── Pace status ──────────────────────────────────────────
// Uses a ratio-based approach so every cadence is judged fairly.
// Thresholds: >= 1.10 = Ahead, >= 0.85 = On Track, < 0.85 = Behind.
// Suppressed for the first 3 days of the month (too noisy).
export function getPaceStatus(logged, expectedByNow, lastDay) {
  if (lastDay < 3) return "early";
  if (expectedByNow <= 0) return logged > 0 ? "ahead" : "early";
  const ratio = logged / expectedByNow;
  if (ratio >= 1.10) return "ahead";
  if (ratio >= 0.85) return "on-track";
  return "behind";
}

// ─── Message pools ────────────────────────────────────────
const PACE_MESSAGES = {
  ahead: [
    "You are ahead of pace. Keep that momentum going!",
    "Overachiever alert. Do not stop now.",
    "You are crushing it this month. Stay consistent!",
    "Ahead of schedule. This is what showing up looks like."
  ],
  "on-track": [
    "Steady progress. You are right where you need to be.",
    "Holding the line. Do not let up.",
    "On track and looking good. Keep it up!",
    "You are doing the work. That is all that matters."
  ],
  behind: [
    "A little behind. A few extra sessions and you are back.",
    "Busy is not an excuse. You have got time.",
    "This will not complete itself. Let us go.",
    "You are not weak, are you? Catch up.",
    "The month is not over yet. Close the gap."
  ],
  early: [
    "Month is just getting started. Show up!"
  ]
};

export function getPaceMessage(status) {
  const pool = PACE_MESSAGES[status] || PACE_MESSAGES["on-track"];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Per-habit streak ─────────────────────────────────────
async function calculateHabitStreak(userId, activity, cadence, yearMonth, markedDays, referenceDate = new Date()) {
  const today = new Date(referenceDate);
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

async function calculateWeeklyStreak(userId, yearMonth, activities, cadences, marks, referenceDate = new Date()) {
  const today = new Date(referenceDate);
  let streak = 0;
  let checkDate = new Date(today);

  for (let w = 0; w < 52; w++) {
    const weekStart = getWeekStart(checkDate);
    const ym = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}`;

    let habitMarks      = marks;
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

// ─── Shared habit stat builder ────────────────────────────
function buildHabitStat(activity, i, marks, cadences, yearMonth, lastDay, today, fullWeeks = [], habitStreak = 0) {
  const cad    = cadences[i] ?? 7;
  const monthTarget = Math.max(1, Math.ceil(cad * (getDaysInMonth(yearMonth) / 7)));
  const logged = (marks[activity] || []).filter(d => d <= lastDay).length;
  const target = Math.max(1, Math.ceil(cad * (lastDay / 7)));
  const rate   = Math.min(100, Math.round(Math.min(1, logged / target) * 100));
  const thisWeekLogged   = logsInWeek(marks[activity] || [], yearMonth, today);
  const thisWeekTarget   = cad;
  const weeklyRate       = Math.min(100, Math.round((thisWeekLogged / thisWeekTarget) * 100));
  const consecutiveDays  = countConsecutiveDays(marks[activity] || [], yearMonth, today);
  const displayLogged = Math.min(logged, monthTarget);
  const extra = Math.max(0, logged - monthTarget);
  const expectedByNow = cad * (lastDay / 7);

  const paceKey = getPaceStatus(logged, expectedByNow, lastDay);
  const paceMessage = getPaceMessage(paceKey);

  // Human-readable label
  const paceLabel = { ahead: "Ahead", "on-track": "On track", behind: "Behind pace", early: "" }[paceKey];

  const fullWeeksBreakdown = fullWeeks.map((w, idx) => {
    const weekLogged = countInRange(marks[activity] || [], w.startDay, w.endDay);
    return {
      label: `Wk${idx + 1}`,
      logged: weekLogged,
      target: cad,
      hit: weekLogged >= cad
    };
  });

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
    consecutiveDays,
    habitStreak,
    monthTarget,
    monthLogged: logged,
    monthRate: Math.min(100, Math.round((logged / monthTarget) * 100)),
    displayLogged,
    extra,
    paceKey,
    paceLabel,
    paceMessage,
    fullWeeksBreakdown
  };
}

// ─── computeStatsFromEntry ────────────────────────────────
export function computeStatsFromEntry(entry, yearMonth) {
  const activities = entry.activities || [];
  const cadences   = entry.cadences   || activities.map(() => 7);
  const marks      = entry.marks      || {};

  if (activities.length === 0) return emptyStats();

  const daysInMonth    = getDaysInMonth(yearMonth);
  const isCurrentMonth = yearMonth === getCurrentYearMonth();
  const lastDay        = isCurrentMonth ? new Date().getDate() : daysInMonth;
  const today          = getReferenceDate(yearMonth, isCurrentMonth, lastDay);
  const fullWeeks = getFullWeeksInMonth(yearMonth);

  const doneDays = new Set();
  activities.forEach(activity => {
    (marks[activity] || []).forEach(d => { if (d <= lastDay) doneDays.add(d); });
  });

  const habitStats = activities.map((activity, i) =>
    buildHabitStat(activity, i, marks, cadences, yearMonth, lastDay, today, fullWeeks, 0)
  );

  const monthlyHits = habitStats.filter(h => h.monthLogged >= h.monthTarget).length;
  const monthlyTargetHitRate = Math.round((monthlyHits / habitStats.length) * 100);

  const overallRate = Math.round(
    habitStats.reduce((sum, h) => sum + h.weeklyRate, 0) / habitStats.length
  );

  return {
    streak: 0,
    doneThisMonth:  doneDays.size,
    totalThisMonth: lastDay,
    overallRate,
    habitStats,
    monthlyTargetHitRate,
    fullWeeksCount: fullWeeks.length
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
    const lastDay        = isCurrentMonth ? new Date().getDate() : daysInMonth;
    const today          = getReferenceDate(yearMonth, isCurrentMonth, lastDay);
    const fullWeeks = getFullWeeksInMonth(yearMonth);

    const doneDays = new Set();
    activities.forEach(activity => {
      (marks[activity] || []).forEach(d => { if (d <= lastDay) doneDays.add(d); });
    });

    const habitStreaks = await Promise.all(
      activities.map((activity, i) =>
        calculateHabitStreak(userId, activity, cadences[i] ?? 7, yearMonth, marks[activity] || [], today)
      )
    );

    const habitStats = activities.map((activity, i) =>
      buildHabitStat(activity, i, marks, cadences, yearMonth, lastDay, today, fullWeeks, habitStreaks[i])
    );

    const monthlyHits = habitStats.filter(h => h.monthLogged >= h.monthTarget).length;
    const monthlyTargetHitRate = Math.round((monthlyHits / habitStats.length) * 100);

    const overallRate = Math.round(
      habitStats.reduce((sum, h) => sum + h.weeklyRate, 0) / habitStats.length
    );

    const streak = await calculateWeeklyStreak(
      userId, yearMonth, activities, cadences, marks, today
    );

    return {
      streak,
      doneThisMonth:  doneDays.size,
      totalThisMonth: lastDay,
      overallRate,
      habitStats,
      monthlyTargetHitRate,
      fullWeeksCount: fullWeeks.length
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
    habitStats: [],
    monthlyTargetHitRate: 0,
    fullWeeksCount: 0
  };
}
