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

function getFullWeeksInMonth(yearMonth, joinDay = null) {
  const [y, m] = yearMonth.split("-").map(Number);
  const totalDays = getDaysInMonth(yearMonth);
  const weeks = [];
  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(y, m - 1, day);
    const isMonday = date.getDay() === 1;
    if (!isMonday) continue;
    const endDay = day + 6;
    if (endDay <= totalDays && (joinDay == null || day >= joinDay)) {
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

function countPerfectDays(activities, marks, lastDay) {
  if (!activities.length) return 0;
  let perfect = 0;
  for (let day = 1; day <= lastDay; day++) {
    const allDone = activities.every(activity => (marks[activity] || []).includes(day));
    if (allDone) perfect++;
  }
  return perfect;
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
// Ratio-based so every cadence is judged on the same relative scale.
// Thresholds: >= 1.10 = ahead, >= 0.85 = on-track, < 0.85 = behind.
// Days 1-3: if no logs => "early", if at least one log => "started".
// isNewUser: true when user joined mid-month (joinDay > 3) and has no logs yet.
export function getPaceStatus(logged, expectedByNow, lastDay, isNewUser = false) {
  if (lastDay <= 3) return logged > 0 ? "started" : "early";
  if (isNewUser && logged === 0) return "new";
  if (expectedByNow <= 0) return logged > 0 ? "ahead" : "early";
  const ratio = logged / expectedByNow;
  if (ratio >= 1.10) return "ahead";
  if (ratio >= 0.85) return "on-track";
  return "behind";
}

// ─── Message pools ────────────────────────────────────────
const PACE_MESSAGES = {
  ahead: [
    "You're ahead of pace. Keep that momentum going!",
    "Overachiever alert. Don't stop now.",
    "You're crushing it this month. Stay consistent!",
    "Ahead of schedule. This is what showing up looks like."
  ],
  "on-track": [
    "Steady progress. You're right where you need to be.",
    "Holding the line. Don't let up.",
    "On track and looking good. Keep it up!",
    "You're doing the work. That's all that matters."
  ],
  behind: [
    "A little behind. A few extra sessions and you're back.",
    "Busy isn't an excuse. You've got time.",
    "This won't complete itself. Let's go.",
    "You're not weak, are you? Catch up.",
    "The month isn't over yet. Close the gap."
  ],
  early: [
    "A fresh month. Start strong and set the tone!",
    "First days of the month. Every log counts from here.",
    "The month is young. Make it count from day one."
  ],
  started: [
    "Congratulations on actually starting!",
    "Great start. Keep the momentum rolling.",
    "You showed up early. Keep going!",
    "Strong opening. Stack another win tomorrow."
  ],
  new: [
    "Late start. Same standards. Let's go.",
    "Mid-month entry. Targets adjusted. No excuses.",
    "You just joined. Time to make up for lost days."
  ]
};

const PAST_PACE_MESSAGES = {
  ahead: [
    "You showed up strong this month. The numbers prove it.",
    "Ahead of target. That was a solid month.",
    "You put in the work. It paid off.",
    "This month belonged to you."
  ],
  "on-track": [
    "You held the line. Solid month.",
    "Right on pace. Consistent and steady.",
    "Not flashy, but you showed up. That counts.",
    "You did what you said you would."
  ],
  behind: [
    "This month fell short. The next one is yours.",
    "Not your best month. That's okay. Keep going.",
    "The data doesn't lie. But neither does a comeback.",
    "Missed the mark. You know what to do next."
  ]
};

function hashString(input = "") {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickDeterministic(pool, variantKey = "") {
  if (!Array.isArray(pool) || pool.length === 0) return "";
  const idx = hashString(variantKey) % pool.length;
  return pool[idx];
}

export function getPaceMessage(status, variantKey = "", isCurrentMonth = true) {
  const pastPool = !isCurrentMonth ? PAST_PACE_MESSAGES[status] : null;
  const pool = pastPool || PACE_MESSAGES[status] || PACE_MESSAGES["on-track"];
  return pickDeterministic(pool, variantKey || status);
}

function getStartedBadgeLabel(variantKey = "") {
  return pickDeterministic(
    ["Started strong", "Good start", "Strong start"],
    variantKey || "started"
  );
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
function buildHabitStat(activity, i, marks, cadences, yearMonth, lastDay, today, fullWeeks = [], habitStreak = 0, daysAvailable = null, joinDay = null, isCurrentMonth = true) {
  const cad    = cadences[i] ?? 7;
  const effectiveDays = daysAvailable ?? getDaysInMonth(yearMonth);
  const monthTarget = Math.max(1, Math.ceil(cad * (effectiveDays / 7)));
  const logged = (marks[activity] || []).filter(d => d <= lastDay).length;
  const target = Math.max(1, Math.ceil(cad * (lastDay / 7)));
  const rate   = Math.min(100, Math.round(Math.min(1, logged / target) * 100));
  const thisWeekLogged   = logsInWeek(marks[activity] || [], yearMonth, today);
  const thisWeekTarget   = cad;
  const weeklyRate       = Math.min(100, Math.round((thisWeekLogged / thisWeekTarget) * 100));
  const consecutiveDays  = countConsecutiveDays(marks[activity] || [], yearMonth, today);
  const displayLogged = Math.min(logged, monthTarget);
  const extra = Math.max(0, logged - monthTarget);

  // ── Use daysSinceJoin for new users so pace is measured from their
  //    actual start date, not the beginning of the month
  const daysSinceJoin = (joinDay != null && joinDay > 1)
    ? Math.max(1, lastDay - (joinDay - 1))
    : lastDay;
  const expectedByNow = cad * (daysSinceJoin / 7);

  const isNewUser = joinDay != null && joinDay > 3 && effectiveDays < getDaysInMonth(yearMonth);
  const paceKey = getPaceStatus(logged, expectedByNow, lastDay, isNewUser);
  const variantKey = `${yearMonth}|${activity}|${paceKey}|${logged}|${lastDay}`;
  const paceMessage = getPaceMessage(paceKey, variantKey, isCurrentMonth);

  // Human-readable badge label
  const paceLabel = {
    ahead:      "Ahead",
    "on-track": "On track",
    behind:     "Behind pace",
    early:      "Early days",
    started:    getStartedBadgeLabel(variantKey),
    new:        "Just started"
  }[paceKey] || "On track";

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
export function computeStatsFromEntry(entry, yearMonth, joinDate = null) {
  const activities = entry.activities || [];
  const cadences   = entry.cadences   || activities.map(() => 7);
  const marks      = entry.marks      || {};

  if (activities.length === 0) return emptyStats();

  const daysInMonth    = getDaysInMonth(yearMonth);
  const isCurrentMonth = yearMonth === getCurrentYearMonth();
  const lastDay        = isCurrentMonth ? new Date().getDate() : daysInMonth;
  const today          = getReferenceDate(yearMonth, isCurrentMonth, lastDay);

  const resolvedJoinDate = joinDate || (entry.joinDate instanceof Date ? entry.joinDate : entry.joinDate ? new Date(entry.joinDate) : null);

  let daysAvailable = daysInMonth;
  let joinDay = null;
  if (resolvedJoinDate) {
    const joinYM = `${resolvedJoinDate.getFullYear()}-${String(resolvedJoinDate.getMonth() + 1).padStart(2, "0")}`;
    if (joinYM === yearMonth) {
      joinDay = resolvedJoinDate.getDate();
      daysAvailable = daysInMonth - (joinDay - 1);
    }
  }
  if (joinDay == null && entry.setupDay > 3) {
    joinDay = entry.setupDay;
    daysAvailable = daysInMonth - (joinDay - 1);
  }

  const fullWeeks = getFullWeeksInMonth(yearMonth, joinDay);

  const doneDays = new Set();
  activities.forEach(activity => {
    (marks[activity] || []).forEach(d => { if (d <= lastDay) doneDays.add(d); });
  });
  const perfectDays = countPerfectDays(activities, marks, lastDay);

  const habitStats = activities.map((activity, i) =>
    buildHabitStat(activity, i, marks, cadences, yearMonth, lastDay, today, fullWeeks, 0, daysAvailable, joinDay, isCurrentMonth)
  );

  const monthlyHits = habitStats.filter(h => h.monthLogged >= h.monthTarget).length;
  const monthlyTargetHitRate = Math.round((monthlyHits / habitStats.length) * 100);

  const overallRate = Math.round(
    habitStats.reduce((sum, h) => sum + h.weeklyRate, 0) / habitStats.length
  );

  return {
    streak: 0,
    doneThisMonth:  doneDays.size,
    showUpDays: doneDays.size,
    perfectDays,
    totalThisMonth: lastDay,
    overallRate,
    habitStats,
    monthlyTargetHitRate,
    fullWeeksCount: fullWeeks.length,
    joinDay
  };
}

// ─── getUserStats ─────────────────────────────────────────
export async function getUserStats(userId, yearMonth) {
  try {
    const [logSnap, userSnap] = await Promise.all([
      getDoc(doc(db, "logs", yearMonth, "entries", userId)),
      getDoc(doc(db, "users", userId))
    ]);
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

    let daysAvailable = daysInMonth;
    let joinDay = null;
    if (userSnap.exists()) {
      const createdAt = userSnap.data().createdAt;
      if (createdAt) {
        const joinDate = createdAt.toDate();
        const joinYM = `${joinDate.getFullYear()}-${String(joinDate.getMonth() + 1).padStart(2, "0")}`;
        if (joinYM === yearMonth) {
          joinDay = joinDate.getDate();
          daysAvailable = daysInMonth - (joinDay - 1);
        }
      }
    }
    const setupDay = data.setupDay;
    if (joinDay == null && setupDay > 3) {
      joinDay = setupDay;
      daysAvailable = daysInMonth - (joinDay - 1);
    }

    const fullWeeks = getFullWeeksInMonth(yearMonth, joinDay);

    const doneDays = new Set();
    activities.forEach(activity => {
      (marks[activity] || []).forEach(d => { if (d <= lastDay) doneDays.add(d); });
    });
    const perfectDays = countPerfectDays(activities, marks, lastDay);

    const habitStreaks = await Promise.all(
      activities.map((activity, i) =>
        calculateHabitStreak(userId, activity, cadences[i] ?? 7, yearMonth, marks[activity] || [], today)
      )
    );

    const habitStats = activities.map((activity, i) =>
      buildHabitStat(activity, i, marks, cadences, yearMonth, lastDay, today, fullWeeks, habitStreaks[i], daysAvailable, joinDay, isCurrentMonth)
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
      showUpDays: doneDays.size,
      perfectDays,
      totalThisMonth: lastDay,
      overallRate,
      habitStats,
      monthlyTargetHitRate,
      fullWeeksCount: fullWeeks.length,
      joinDay
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
    showUpDays: 0,
    perfectDays: 0,
    totalThisMonth: 0,
    overallRate: 0,
    habitStats: [],
    monthlyTargetHitRate: 0,
    fullWeeksCount: 0
  };
}
