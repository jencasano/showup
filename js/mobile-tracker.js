import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getDaysInMonth, getDayLabel, getCurrentYearMonth } from "./utils.js";
import { getActivityColor, ACTIVITY_COLORS } from "./tracker.js";
import { showToast } from "./ui.js";

const MARKER_SYMBOLS = {
  circle:   "●",
  star:     "★",
  heart:    "♥",
  check:    "✓",
  x:        "✗",
  scribble: "〰"
};

// ─── RENDER MOBILE CALENDAR CARD ────────────────────
export function renderMobileCard(entry, yearMonth, currentUser) {
  const isOwner = currentUser && currentUser.uid === entry.id;
  const isCurrentMonth = yearMonth === getCurrentYearMonth();
  const todayDate = new Date().getDate();
  const { color, fontColor, font, sticker, marker, avatarUrl } = entry.decoration;

  // State for activity filter
  let activeFilter = null;

  // ── Card wrapper
  const card = document.createElement("div");
  card.className = "cal-card";
  card.style.borderColor = color;

  // ── Badge
  const badge = document.createElement("div");
  badge.className = "cal-card-badge";
  badge.style.background = color;
  badge.style.color = fontColor;
  badge.style.fontFamily = `'${font}', sans-serif`;
  const avatarHTML = avatarUrl
    ? `<img src="${avatarUrl}" class="cal-card-avatar" alt="avatar" />`
    : "";
  badge.innerHTML = `
    ${avatarHTML}
    <span class="cal-card-name">${entry.displayName}</span>
    <span class="cal-card-sticker">${sticker}</span>
  `;
  card.appendChild(badge);

  // ── Filter pill (hidden by default)
  const filterBar = document.createElement("div");
  filterBar.className = "cal-filter-bar";
  filterBar.style.display = "none";
  card.appendChild(filterBar);

  // ── Calendar body
  const calBody = document.createElement("div");
  calBody.className = "cal-card-body";
  card.appendChild(calBody);

  // ── Footer stats
  const footer = document.createElement("div");
  footer.className = "cal-card-footer";
  card.appendChild(footer);

  // ── Render/re-render calendar
  function render() {
    calBody.innerHTML = "";
    renderCalGrid(calBody, entry, yearMonth, isCurrentMonth, todayDate, activeFilter, isOwner, color, marker, onDayTap, onFilterClear);
    renderFilterBar(filterBar, activeFilter, entry.activities, color);
    renderFooter(footer, entry, yearMonth, todayDate, isCurrentMonth, activeFilter, color);
  }

  // ── Day tap handler
  function onDayTap(day) {
    const isFuture = isCurrentMonth && day > todayDate;
    if (isFuture) return;
    showDaySheet(day, entry, yearMonth, isOwner, isCurrentMonth, todayDate, marker, color,
      async (activity, newMarkedDays) => {
        // Update entry marks optimistically
        if (!entry.marks) entry.marks = {};
        entry.marks[activity] = newMarkedDays;
        render();
        // Persist
        try {
          const logRef = doc(db, "logs", yearMonth, "entries", entry.id);
          const logSnap = await getDoc(logRef);
          if (logSnap.exists()) {
            await updateDoc(logRef, { [`marks.${activity}`]: newMarkedDays });
          } else {
            await setDoc(logRef, { userId: entry.id, yearMonth, marks: { [activity]: newMarkedDays } });
          }
        } catch (err) {
          console.error("Toggle error:", err);
          showToast("Couldn't save. Try again.", "error");
        }
      },
      (activityName) => {
        // Filter to this activity
        activeFilter = activityName;
        render();
        // Close sheet
        document.querySelector(".day-sheet-overlay")?.remove();
      }
    );
  }

  // ── Clear filter
  function onFilterClear() {
    activeFilter = null;
    render();
  }

  render();
  return card;
}

// ─── RENDER CALENDAR GRID ───────────────────────────
function renderCalGrid(container, entry, yearMonth, isCurrentMonth, todayDate, activeFilter, isOwner, color, marker, onDayTap, onFilterClear) {
  const daysInMonth = getDaysInMonth(yearMonth);
  const marks = entry.marks || {};
  const activities = entry.activities || [];

  // Day of week headers
  const headers = document.createElement("div");
  headers.className = "cal-grid-headers";
  ["S","M","T","W","T","F","S"].forEach(d => {
    const h = document.createElement("div");
    h.className = "cal-grid-header";
    h.textContent = d;
    headers.appendChild(h);
  });
  container.appendChild(headers);

  // Days grid
  const grid = document.createElement("div");
  grid.className = "cal-grid-days";

  // Find which day of week month starts on
  const [year, month] = yearMonth.split("-").map(Number);
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  // Empty cells before month starts
  for (let i = 0; i < firstDayOfWeek; i++) {
    const empty = document.createElement("div");
    grid.appendChild(empty);
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    cell.className = "cal-grid-day";

    const isToday = isCurrentMonth && d === todayDate;
    const isFuture = isCurrentMonth && d > todayDate;

    if (isToday)  cell.classList.add("cal-day-today");
    if (isFuture) cell.classList.add("cal-day-future");

    const dayNum = document.createElement("span");
    dayNum.className = "cal-day-num";
    dayNum.textContent = d;
    cell.appendChild(dayNum);

    if (activeFilter) {
      // Filtered view — show single activity
      const actIndex = activities.indexOf(activeFilter);
      const actColor = getActivityColor(actIndex);
      const markedDays = marks[activeFilter] || [];
      const isDone = markedDays.includes(d);
      if (isDone && !isFuture) {
        cell.classList.add("cal-day-done");
        cell.style.background = actColor;
        dayNum.style.color = "white";
        const dot = document.createElement("span");
        dot.className = "cal-day-big-dot";
        dot.style.background = "rgba(255,255,255,0.7)";
        cell.appendChild(dot);
      }
    } else {
      // Default view — show all/partial/full
      let doneCount = 0;
      activities.forEach(act => {
        const markedDays = marks[act] || [];
        if (markedDays.includes(d)) doneCount++;
      });

      if (!isFuture && doneCount > 0) {
        const count = document.createElement("span");
        count.className = "cal-day-count";
        if (doneCount === activities.length) {
          cell.classList.add("cal-day-full");
          cell.style.background = color;
          dayNum.style.color = "white";
          count.style.color = "rgba(255,255,255,0.8)";
        } else {
          cell.classList.add("cal-day-partial");
          cell.style.background = hexWithOpacity(color, 0.2);
          dayNum.style.color = color;
          count.style.color = color;
        }
        count.textContent = `${doneCount}/${activities.length}`;
        cell.appendChild(count);
      }
    }

    if (!isFuture) {
      cell.style.cursor = "pointer";
      cell.addEventListener("click", () => onDayTap(d));
    }

    grid.appendChild(cell);
  }

  container.appendChild(grid);
}

// ─── RENDER FILTER BAR ──────────────────────────────
function renderFilterBar(filterBar, activeFilter, activities, color) {
  if (!activeFilter) {
    filterBar.style.display = "none";
    return;
  }
  filterBar.style.display = "flex";
  const actIndex = activities.indexOf(activeFilter);
  const actColor = getActivityColor(actIndex);
  filterBar.innerHTML = `
    <span class="filter-label">Showing:</span>
    <span class="filter-pill" style="background:${actColor};color:white;">
      ${activeFilter} ×
    </span>
    <span class="filter-hint">tap pill to clear</span>
  `;
  filterBar.querySelector(".filter-pill").addEventListener("click", () => {
    filterBar.dispatchEvent(new CustomEvent("clear-filter"));
  });
}

// ─── RENDER FOOTER STATS ───────────────────────────
function renderFooter(footer, entry, yearMonth, todayDate, isCurrentMonth, activeFilter, color) {
  const marks = entry.marks || {};
  const activities = entry.activities || [];
  const lastDay = isCurrentMonth ? todayDate : getDaysInMonth(yearMonth);

  // Count days where at least one activity done
  let doneDays = 0;
  for (let d = 1; d <= lastDay; d++) {
    const anyDone = activities.some(act => (marks[act] || []).includes(d));
    if (anyDone) doneDays++;
  }

  const rate = lastDay > 0 ? Math.round(doneDays / lastDay * 100) : 0;

  footer.innerHTML = `
    <div class="cal-stat">
      <div class="cal-stat-val" style="color:${color}">${doneDays}</div>
      <div class="cal-stat-label">Days done</div>
    </div>
    <div class="cal-stat">
      <div class="cal-stat-val">${rate}%</div>
      <div class="cal-stat-label">Rate</div>
    </div>
  `;
}

// ─── SHOW DAY SHEET ───────────────────────────────
function showDaySheet(day, entry, yearMonth, isOwner, isCurrentMonth, todayDate, marker, badgeColor, onToggle, onFilter) {
  // Remove existing sheet
  document.querySelector(".day-sheet-overlay")?.remove();

  const activities = entry.activities || [];
  const marks = entry.marks || {};
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const dateLabel = date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const isToday = isCurrentMonth && day === todayDate;

  const overlay = document.createElement("div");
  overlay.className = "day-sheet-overlay";

  const sheet = document.createElement("div");
  sheet.className = "day-sheet";

  const handle = document.createElement("div");
  handle.className = "day-sheet-handle";
  sheet.appendChild(handle);

  const dateEl = document.createElement("div");
  dateEl.className = "day-sheet-date";
  dateEl.textContent = isToday ? `${dateLabel} — today ✨` : dateLabel;
  sheet.appendChild(dateEl);

  // Activity rows
  activities.forEach((activity, index) => {
    const actColor = getActivityColor(index);
    const markedDays = [...(marks[activity] || [])];
    const isMarked = markedDays.includes(day);

    const row = document.createElement("div");
    row.className = "day-sheet-row";

    // Marker circle
    const circle = document.createElement("div");
    circle.className = "day-sheet-circle";
    if (isMarked) {
      circle.classList.add("done");
      circle.style.background = actColor;
      circle.style.borderColor = actColor;
      circle.textContent = MARKER_SYMBOLS[marker] || "●";
      circle.style.color = "white";
    } else {
      circle.style.borderColor = actColor;
    }

    // Activity name (tap to filter)
    const name = document.createElement("div");
    name.className = "day-sheet-name";
    name.textContent = activity;

    const arrow = document.createElement("span");
    arrow.className = "day-sheet-arrow";
    arrow.textContent = "→";

    row.appendChild(circle);
    row.appendChild(name);
    row.appendChild(arrow);
    sheet.appendChild(row);

    // Toggle on circle tap (owner only)
    if (isOwner) {
      circle.style.cursor = "pointer";
      circle.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = markedDays.indexOf(day);
        if (idx > -1) {
          markedDays.splice(idx, 1);
          circle.classList.remove("done");
          circle.style.background = "";
          circle.textContent = "";
          circle.style.color = "";
          circle.style.borderColor = actColor;
        } else {
          markedDays.push(day);
          circle.classList.add("done");
          circle.style.background = actColor;
          circle.style.borderColor = actColor;
          circle.textContent = MARKER_SYMBOLS[marker] || "●";
          circle.style.color = "white";
        }
        onToggle(activity, markedDays);
      });
    }

    // Filter on name tap
    name.style.cursor = "pointer";
    name.addEventListener("click", () => onFilter(activity));
    arrow.style.cursor = "pointer";
    arrow.addEventListener("click", () => onFilter(activity));
  });

  // Hint
  const hint = document.createElement("div");
  hint.className = "day-sheet-hint";
  hint.textContent = isOwner
    ? "tap ○ to mark done · tap name → to filter calendar"
    : "tap name → to filter calendar";
  sheet.appendChild(hint);

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  // Close on overlay tap
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// ─── HELPERS ──────────────────────────────────────
function hexWithOpacity(hex, opacity) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}
