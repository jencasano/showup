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

// "2026-03" → "2026-02"
export function getPrevYearMonth(yearMonth) {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// "2026-03" → "2026-04"
export function getNextYearMonth(yearMonth) {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Convert hex color to HSL
function hexToHsl(hex) {
  let r = parseInt(hex.slice(1,3),16) / 255;
  let g = parseInt(hex.slice(3,5),16) / 255;
  let b = parseInt(hex.slice(5,7),16) / 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch(max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

// Convert HSL to hex
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0),f(8),f(4)].map(x =>
    Math.round(x * 255).toString(16).padStart(2,'0')
  ).join('');
}

// Activity colors palette (shared across tracker modules)
// Sourced from MIXTAPE_SPEC §4: red / blue / yellow / green + teal.
export const ACTIVITY_COLORS = [
  "#C3342B",
  "#4F6C8E",
  "#E8B33A",
  "#3E5C3A",
  "#5EAAA8",
];

export function getActivityColor(index) {
  return ACTIVITY_COLORS[index % ACTIVITY_COLORS.length];
}

// Get 4 complementary font color suggestions for a given badge color
export function getFontColorSuggestions(hex) {
  const [h, s, l] = hexToHsl(hex);
  return [
    "#FFFFFF",                          // white
    "#333333",                          // dark
    hslToHex(h, Math.min(s, 30), 95),  // very light tint
    hslToHex(h, Math.min(s + 10, 100), Math.max(l - 40, 10)) // deep shade
  ];
}