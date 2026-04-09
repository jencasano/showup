// --- Load signal copy from JSON (once, at module load) -------------------

const HARDCODED_COPY = {
  first_ever:  "{firstName} just started. Day one.",
  comeback_30: "{firstName} is back. Something's stirring.",
  comeback_7:  "{firstName} is finding their rhythm again.",
  streak_25:   "{firstName} has been incredibly consistent this month.",
  streak_15:   "{firstName} has been showing up a lot lately.",
  streak_7:    "{firstName} is building something.",
  streak_3:    "{firstName} showed up again today.",
  checked_in:  "{firstName} just checked in.",
  fallback:    "{firstName} is showing up quietly.",
};

let signalCopy = HARDCODED_COPY;

const copyReady = fetch("data/signal-copy.json")
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(json => { signalCopy = json; })
  .catch(() => { /* keep HARDCODED_COPY */ });

function fillName(template, firstName) {
  return template.replace("{firstName}", firstName);
}

// -------------------------------------------------------------------------

export function computeSignal(displayName, logEntry) {
  const firstName = (displayName || "").split(" ")[0] || displayName;
  const fallback  = { headline: fillName(signalCopy.fallback, firstName), sub: "Showing up quietly." };

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
  if      (isFirstEver)          headline = fillName(signalCopy.first_ever,  firstName);
  else if (isComeback30)         headline = fillName(signalCopy.comeback_30, firstName);
  else if (isComeback7)          headline = fillName(signalCopy.comeback_7,  firstName);
  else if (streak >= 25)         headline = fillName(signalCopy.streak_25,   firstName);
  else if (streak >= 15)         headline = fillName(signalCopy.streak_15,   firstName);
  else if (streak >= 7)          headline = fillName(signalCopy.streak_7,    firstName);
  else if (streak >= 3)          headline = fillName(signalCopy.streak_3,    firstName);
  else if (totalDaysActive >= 1) headline = fillName(signalCopy.checked_in,  firstName);
  else                           return fallback;

  return { headline, sub: "Showing up quietly." };
}

export { copyReady };
