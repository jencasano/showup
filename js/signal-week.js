// signal-week.js -- Per-week cadence check for the perfect_week signal.
// See docs/PERFECT_WEEK_SPEC.md.

function actName(a) { return typeof a === "string" ? a : a?.name; }

export function checkPerfectWeek(logEntry, yearMonth, referenceDate = new Date()) {
  if (!logEntry || !yearMonth) return false;
  const { activities, cadences, marks } = logEntry;
  if (!Array.isArray(activities) || !Array.isArray(cadences) || !marks) return false;
  if (activities.length === 0 || cadences.length === 0) return false;

  const [yearStr, monthStr] = String(yearMonth).split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return false;

  // Perfect week only applies to the current calendar month.
  if (referenceDate.getFullYear() !== year || referenceDate.getMonth() + 1 !== month) {
    return false;
  }

  const todayDay = referenceDate.getDate();
  const dow = referenceDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const sundayDay = dow === 0 ? todayDay : todayDay - dow;
  const mondayDay = sundayDay - 6;

  // Week must fall entirely within this month -- no cross-month evaluation.
  if (mondayDay < 1) return false;

  const len = Math.min(activities.length, cadences.length);
  for (let i = 0; i < len; i++) {
    const name = actName(activities[i]);
    const target = cadences[i];
    if (!name || typeof target !== "number" || target <= 0) return false;
    const days = marks[name] || [];
    let count = 0;
    for (const d of days) {
      if (d >= mondayDay && d <= sundayDay) count++;
    }
    if (count < target) return false;
  }
  return true;
}
