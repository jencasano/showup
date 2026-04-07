export function computeSignal(displayName, logEntry) {
  const firstName = (displayName || "").split(" ")[0] || displayName;
  const fallback  = { headline: `${firstName} is showing up quietly.`, sub: "Showing up quietly." };

  if (!logEntry || !logEntry.marks || Object.keys(logEntry.marks).length === 0) {
    return fallback;
  }

  const marks = logEntry.marks;

  // Collect all unique days that have at least one mark
  const activeDaysSet = new Set();
  for (const days of Object.values(marks)) {
    for (const day of days) activeDaysSet.add(day);
  }

  if (activeDaysSet.size === 0) return fallback;

  const today        = new Date().getDate();
  const totalDaysActive = activeDaysSet.size;
  const sortedDays   = [...activeDaysSet].sort((a, b) => a - b);
  const lastActiveDay = sortedDays[sortedDays.length - 1];

  // currentStreak: consecutive days ending on lastActiveDay
  let streak = 0;
  let day = lastActiveDay;
  while (activeDaysSet.has(day)) {
    streak++;
    day--;
  }

  const daysSinceLastActive = today - lastActiveDay; // 0 if active today

  const isFirstEver   = totalDaysActive === 1 && lastActiveDay === 1 && today <= 2;
  const isComeback30  = daysSinceLastActive >= 30;
  const isComeback7   = daysSinceLastActive >= 7 && daysSinceLastActive < 30;

  let headline;
  if      (isFirstEver)      headline = `${firstName} just started. Day one.`;
  else if (isComeback30)     headline = `${firstName} is back. Something's stirring.`;
  else if (isComeback7)      headline = `${firstName} is finding their rhythm again.`;
  else if (streak >= 25)     headline = `${firstName} has been incredibly consistent this month.`;
  else if (streak >= 15)     headline = `${firstName} has been showing up a lot lately.`;
  else if (streak >= 7)      headline = `${firstName} is building something.`;
  else if (streak >= 3)      headline = `${firstName} showed up again today.`;
  else if (totalDaysActive >= 1) headline = `${firstName} just checked in.`;
  else                       return fallback;

  return { headline, sub: "Showing up quietly." };
}
