// --- Load signal copy from JSON (once, at module load) -------------------

const HARDCODED_COPY = {
  first_ever_calendar:  "{firstName} just started. Day one.",
  first_ever_diary:     "Something's beginning for {firstName}.",
  comeback_30_calendar: "{firstName} is back. Something's stirring.",
  comeback_30_diary:    "{firstName} went quiet for a while. Now they're back.",
  comeback_7_calendar:  "{firstName} is finding their rhythm again.",
  comeback_7_diary:     "Feels like {firstName} is working something out.",
  streak_25_calendar:   "{firstName} has been incredibly consistent this month.",
  streak_25_diary:      "There's a lot going on in {firstName}'s world right now.",
  streak_15_calendar:   "{firstName} has been showing up a lot lately.",
  streak_15_diary:      "{firstName} has been in their head lately. In a good way.",
  streak_7_calendar:    "{firstName} is building something.",
  streak_7_diary:       "Something's taking shape for {firstName}.",
  streak_3_calendar:    "{firstName} showed up again today.",
  streak_3_diary:       "{firstName} has been showing up.",
  checked_in_calendar:  "{firstName} just checked in.",
  checked_in_diary:     "{firstName} stopped by.",
  fallback_calendar:    "{firstName} is showing up quietly.",
  fallback_diary:       "{firstName} is keeping this one close.",
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
  const fallback  = {
    calendarHeadline: fillName(signalCopy.fallback_calendar, firstName),
    diaryHeadline:    fillName(signalCopy.fallback_diary,    firstName),
    sub: "Showing up quietly.",
  };

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

  let key;
  if      (isFirstEver)          key = "first_ever";
  else if (isComeback30)         key = "comeback_30";
  else if (isComeback7)          key = "comeback_7";
  else if (streak >= 25)         key = "streak_25";
  else if (streak >= 15)         key = "streak_15";
  else if (streak >= 7)          key = "streak_7";
  else if (streak >= 3)          key = "streak_3";
  else if (totalDaysActive >= 1) key = "checked_in";
  else                           return fallback;

  return {
    calendarHeadline: fillName(signalCopy[key + "_calendar"], firstName),
    diaryHeadline:    fillName(signalCopy[key + "_diary"],    firstName),
    sub: "Showing up quietly.",
  };
}

export { copyReady };
