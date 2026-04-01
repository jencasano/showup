import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getCurrentYearMonth, getPrevYearMonth, getDaysInMonth } from "./utils.js";

// ─── Calculate streak and monthly stats for a user ───
// Returns { streak, doneThisMonth, totalThisMonth }
export async function getUserStats(userId, yearMonth) {
  try {
    const logSnap = await getDoc(doc(db, "logs", yearMonth, "entries", userId));
    if (!logSnap.exists()) return { streak: 0, doneThisMonth: 0, totalThisMonth: 0 };

    const data = logSnap.data();
    const activities = data.activities || [];
    const marks = data.marks || {};

    // Days that have at least one activity marked
    const daysInMonth = getDaysInMonth(yearMonth);
    const today = new Date();
    const isCurrentMonth = yearMonth === getCurrentYearMonth();
    const lastDay = isCurrentMonth ? today.getDate() : daysInMonth;

    // Build a set of days where ANY activity was done
    const doneDays = new Set();
    for (const activity of activities) {
      const days = marks[activity] || [];
      days.forEach(d => doneDays.add(d));
    }

    // Count days done this month (up to today)
    let doneThisMonth = 0;
    for (let d = 1; d <= lastDay; d++) {
      if (doneDays.has(d)) doneThisMonth++;
    }

    // Calculate streak — consecutive days going back from today
    const streak = await calculateStreak(userId, yearMonth, doneDays, lastDay);

    return {
      streak,
      doneThisMonth,
      totalThisMonth: lastDay
    };
  } catch (error) {
    console.error("Stats error:", error);
    return { streak: 0, doneThisMonth: 0, totalThisMonth: 0 };
  }
}

// Walk backwards from today counting consecutive active days
async function calculateStreak(userId, yearMonth, doneDaysThisMonth, startDay) {
  let streak = 0;
  let day = startDay;
  let ym = yearMonth;
  let doneDays = doneDaysThisMonth;

  while (true) {
    if (day < 1) {
      // Cross into previous month
      ym = getPrevYearMonth(ym);
      const prevSnap = await getDoc(doc(db, "logs", ym, "entries", userId));
      if (!prevSnap.exists()) break;

      const prevData = prevSnap.data();
      const prevActivities = prevData.activities || [];
      const prevMarks = prevData.marks || {};
      doneDays = new Set();
      for (const activity of prevActivities) {
        (prevMarks[activity] || []).forEach(d => doneDays.add(d));
      }
      day = getDaysInMonth(ym);
    }

    if (doneDays.has(day)) {
      streak++;
      day--;
    } else {
      break;
    }
  }

  return streak;
}
