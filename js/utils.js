// Get current year-month string e.g. "2026-03"
export function getCurrentYearMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

// Get number of days in a given year-month string
export function getDaysInMonth(yearMonth) {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

// Format "2026-03" → "March 2026"
export function formatYearMonth(yearMonth) {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Get day-of-week label for a given date e.g. "M", "T"
export function getDayLabel(yearMonth, day) {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return ["S","M","T","W","T","F","S"][date.getDay()];
}