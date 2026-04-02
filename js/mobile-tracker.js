import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, updateDoc,
  arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getDaysInMonth, getCurrentYearMonth } from "./utils.js";
import { getActivityColor } from "./tracker.js";
import { showToast } from "./ui.js";
import { computeStatsFromEntry } from "./stats.js";

const MARKER_SYMBOLS = {
  circle:   "●",
  star:     "★",
  heart:    "♥",
  check:    "✓",
  x:        "✗",
  scribble: "〰"
};

// ─── RENDER MOBILE CALENDAR CARD ────────────────────
// opts.onMarkToggled — optional callback(entry) fired immediately
// after a habit is toggled. loadMyLog passes this to refresh the
// summary card and status banner in-place without any page reload.
export function renderMobileCard(entry, yearMonth, currentUser, opts = {}) {
  const { isFollowing = false, showFollowBtn = false, onMarkToggled = null } = opts;
  const isOwner = currentUser && currentUser.uid === entry.id;
  const isCurrentMonth = yearMonth === getCurrentYearMonth();
  const todayDate = new Date().getDate();
  const { color, fontColor, font, sticker, marker, avatarUrl } = entry.decoration;

  let activeFilter = null;
  let following = isFollowing;
  let followLoading = false;

  const card = document.createElement("div");
  card.className = "cal-card";
  card.style.borderColor = color;

  // ── Badge / Header ──────────────────────────────────
  const badge = document.createElement("div");
  badge.className = "cal-card-badge";
  badge.style.background = color;
  badge.style.color = fontColor;
  badge.style.fontFamily = `'${font}', sans-serif`;

  const avatarEl = document.createElement("div");
  avatarEl.className = "cal-card-avatar-wrap";
  if (avatarUrl) {
    avatarEl.innerHTML = `<img src="${avatarUrl}" class="cal-card-avatar" alt="avatar" />`;
  } else {
    const initials = (entry.displayName || "?").charAt(0).toUpperCase();
    avatarEl.innerHTML = `<div class="cal-card-avatar-initials">${initials}</div>`;
  }

  const nameWrap = document.createElement("div");
  nameWrap.className = "cal-card-name-wrap";
  nameWrap.innerHTML = `
    <span class="cal-card-name">${entry.displayName}</span>
    <span class="cal-card-sticker">${sticker}</span>
  `;

  badge.appendChild(avatarEl);
  badge.appendChild(nameWrap);

  // ── Follow / Unfollow button ────────────────────────
  if (showFollowBtn && !isOwner && currentUser) {
    const followBtn = document.createElement("button");
    followBtn.className = `cal-follow-btn ${following ? "following" : ""}`;
    followBtn.innerHTML = following
      ? `<span class="follow-btn-check">✓</span> Following`
      : `<span class="follow-btn-plus">+</span> Follow`;

    followBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (followLoading) return;
      followLoading = true;
      followBtn.disabled = true;
      followBtn.classList.add("loading");
      try {
        const myRef = doc(db, "users", currentUser.uid);
        if (following) {
          await setDoc(myRef, { following: arrayRemove(entry.id) }, { merge: true });
          following = false;
          followBtn.innerHTML = `<span class="follow-btn-plus">+</span> Follow`;
          followBtn.classList.remove("following");
        } else {
          await setDoc(myRef, { following: arrayUnion(entry.id) }, { merge: true });
          following = true;
          followBtn.innerHTML = `<span class="follow-btn-check">✓</span> Following`;
          followBtn.classList.add("following");
        }
      } catch (err) {
        console.error("Follow error:", err);
        showToast("Couldn't update follow. Try again.", "error");
      } finally {
        followLoading = false;
        followBtn.disabled = false;
        followBtn.classList.remove("loading");
      }
    });
    badge.appendChild(followBtn);
  }

  if (isOwner) {
    const youPill = document.createElement("span");
    youPill.className = "cal-you-pill";
    youPill.textContent = "you";
    badge.appendChild(youPill);
  }

  card.appendChild(badge);

  // ── Filter Bar ──────────────────────────────────────
  const filterBar = document.createElement("div");
  filterBar.className = "cal-filter-bar";
  filterBar.style.display = "none";
  card.appendChild(filterBar);

  // ── Calendar Body ───────────────────────────────────
  const calBody = document.createElement("div");
  calBody.className = "cal-card-body";
  card.appendChild(calBody);

  // ── Footer Stats ────────────────────────────────────
  const footer = document.createElement("div");
  footer.className = "cal-card-footer";
  card.appendChild(footer);

  function render() {
    calBody.innerHTML = "";
    renderCalGrid(calBody, entry, yearMonth, isCurrentMonth, todayDate, activeFilter, isOwner, color, marker, onDayTap);
    renderFilterBar(filterBar, activeFilter, entry.activities, onFilterClear);
    renderFooter(footer, entry, yearMonth, todayDate, isCurrentMonth, color);
  }

  function onDayTap(day) {
    const isFuture = isCurrentMonth && day > todayDate;
    if (isFuture) return;
    showDaySheet(day, entry, yearMonth, isOwner, isCurrentMonth, todayDate, marker,
      async (activity, newMarkedDays) => {
        // 1. Update local entry state immediately.
        if (!entry.marks) entry.marks = {};
        entry.marks[activity] = newMarkedDays;

        // 2. Re-render card grid + footer in-place (no flash).
        render();

        // 3. If loadMyLog passed a callback, call it now so the
        //    summary card and status banner update instantly too.
        if (onMarkToggled) onMarkToggled(entry);

        // 4. Persist to Firestore in the background.
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
        activeFilter = activityName;
        render();
        document.querySelector(".day-sheet-overlay")?.remove();
      }
    );
  }

  function onFilterClear() {
    activeFilter = null;
    render();
  }

  render();
  return card;
}

// ─── RENDER CALENDAR GRID ───────────────────────────
function renderCalGrid(container, entry, yearMonth, isCurrentMonth, todayDate, activeFilter, isOwner, color, marker, onDayTap) {
  const daysInMonth = getDaysInMonth(yearMonth);
  const marks = entry.marks || {};
  const activities = entry.activities || [];

  const headers = document.createElement("div");
  headers.className = "cal-grid-headers";
  ["S","M","T","W","T","F","S"].forEach(d => {
    const h = document.createElement("div");
    h.className = "cal-grid-header";
    h.textContent = d;
    headers.appendChild(h);
  });
  container.appendChild(headers);

  const grid = document.createElement("div");
  grid.className = "cal-grid-days";

  const [year, month] = yearMonth.split("-").map(Number);
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  for (let i = 0; i < firstDayOfWeek; i++) {
    grid.appendChild(document.createElement("div"));
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    cell.className = "cal-grid-day";

    const isToday  = isCurrentMonth && d === todayDate;
    const isFuture = isCurrentMonth && d > todayDate;

    if (isToday)  cell.classList.add("cal-day-today");
    if (isFuture) cell.classList.add("cal-day-future");

    const dayNum = document.createElement("span");
    dayNum.className = "cal-day-num";
    dayNum.textContent = d;
    cell.appendChild(dayNum);

    if (activeFilter) {
      const actIndex = activities.indexOf(activeFilter);
      const actColor = getActivityColor(actIndex);
      const markedDays = marks[activeFilter] || [];
      if (markedDays.includes(d) && !isFuture) {
        cell.classList.add("cal-day-done");
        cell.style.background = actColor;
        dayNum.style.color = "white";
        const dot = document.createElement("span");
        dot.className = "cal-day-big-dot";
        dot.style.background = "rgba(255,255,255,0.7)";
        cell.appendChild(dot);
      }
    } else {
      let doneCount = 0;
      activities.forEach(act => {
        if ((marks[act] || []).includes(d)) doneCount++;
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
function renderFilterBar(filterBar, activeFilter, activities, onFilterClear) {
  if (!activeFilter) {
    filterBar.style.display = "none";
    filterBar.innerHTML = "";
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
  filterBar.querySelector(".filter-pill").addEventListener("click", onFilterClear);
}

// ─── RENDER FOOTER STATS ────────────────────────────
function renderFooter(footer, entry, yearMonth, todayDate, isCurrentMonth, color) {
  const marks = entry.marks || {};
  const activities = entry.activities || [];
  const daysInMonth = getDaysInMonth(yearMonth);
  const lastDay = isCurrentMonth ? todayDate : daysInMonth;

  let doneDays = 0;
  let streak = 0;
  for (let d = 1; d <= lastDay; d++) {
    if (activities.some(act => (marks[act] || []).includes(d))) doneDays++;
  }

  let s = lastDay;
  while (s >= 1 && activities.some(act => (marks[act] || []).includes(s))) {
    streak++;
    s--;
  }

  const rate = lastDay > 0 ? Math.round(doneDays / lastDay * 100) : 0;

  footer.innerHTML = `
    <div class="cal-stat">
      <div class="cal-stat-val" style="color:${color}">${doneDays}</div>
      <div class="cal-stat-label">Days Done</div>
    </div>
    <div class="cal-stat">
      <div class="cal-stat-val">🔥 ${streak}</div>
      <div class="cal-stat-label">Streak</div>
    </div>
    <div class="cal-stat">
      <div class="cal-stat-val">${rate}%</div>
      <div class="cal-stat-label">Rate</div>
    </div>
  `;
}

// ─── SHOW DAY SHEET ─────────────────────────────────
function showDaySheet(day, entry, yearMonth, isOwner, isCurrentMonth, todayDate, marker, onToggle, onFilter) {
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
  sheet.innerHTML = `<div class="day-sheet-handle"></div>`;

  const dateEl = document.createElement("div");
  dateEl.className = "day-sheet-date";
  dateEl.textContent = isToday ? `${dateLabel} — today ✨` : dateLabel;
  sheet.appendChild(dateEl);

  activities.forEach((activity, index) => {
    const actColor = getActivityColor(index);
    const markedDays = [...(marks[activity] || [])];
    const isMarked = markedDays.includes(day);

    const row = document.createElement("div");
    row.className = "day-sheet-row";

    const circle = document.createElement("div");
    circle.className = "day-sheet-circle";
    circle.style.borderColor = actColor;
    if (isMarked) {
      circle.classList.add("done");
      circle.style.background = actColor;
      circle.textContent = MARKER_SYMBOLS[marker] || "●";
      circle.style.color = "white";
    }

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
        } else {
          markedDays.push(day);
          circle.classList.add("done");
          circle.style.background = actColor;
          circle.textContent = MARKER_SYMBOLS[marker] || "●";
          circle.style.color = "white";
        }
        onToggle(activity, markedDays);
      });
    }

    name.style.cursor = "pointer";
    arrow.style.cursor = "pointer";
    const filterHandler = () => onFilter(activity);
    name.addEventListener("click", filterHandler);
    arrow.addEventListener("click", filterHandler);
  });

  const hint = document.createElement("div");
  hint.className = "day-sheet-hint";
  hint.textContent = isOwner
    ? "tap ○ to mark done · tap name → to filter calendar"
    : "tap name → to filter calendar";
  sheet.appendChild(hint);

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// ─── HELPERS ────────────────────────────────────────
function hexWithOpacity(hex, opacity) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}
