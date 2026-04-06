import { db, auth } from "./firebase-config.js";
import {
  doc, getDoc, setDoc,
  updateDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getDaysInMonth, getDayLabel, getCurrentYearMonth, getActivityColor } from "./utils.js";
import { showToast, showLoader, hideLoader } from "./ui.js";
import { renderMobileCard } from "./mobile-tracker.js";
import { getUserStats, computeStatsFromEntry, cadenceLabel } from "./stats.js";
import { icon, STICKER_ICONS } from "./icons.js";
import { openManageActivitiesModal } from "./manage-activities.js";
import { renderMonthlySummary } from "./tracker-summary.js";
import { renderDiaryNotebook } from "./tracker-diary.js";

const MARKER_SYMBOLS = {
  square:   "\u25a0",
  circle:   "\u25cf",
  star:     "\u2605",
  heart:    "\u2665",
  check:    "\u2713",
  x:        "\u2717",
  scribble: "\u3030"
};

function isMobile() {
  return window.innerWidth <= 768;
}

let unsubscribe = null;

function renderSticker(sticker) {
  if (STICKER_ICONS.includes(sticker)) {
    return icon(sticker, 20, "badge-sticker-icon");
  }
  return sticker || "";
}

// ─── LOAD MY LOG ──────────────────────────────────────────
export function loadMyLog(yearMonth, container, currentUser, initialStatsPromise = null, silent = false) {
  if (!silent) showLoader();
  container.innerHTML = "";

  if (unsubscribe) { unsubscribe(); unsubscribe = null; }

  const isCurrentMonth = yearMonth === getCurrentYearMonth();
  const todayDate = new Date().getDate();
  const uid = currentUser?.uid || auth.currentUser?.uid;

  if (!uid) {
    hideLoader();
    container.innerHTML = `<p class="empty-state">Not logged in.</p>`;
    return;
  }

  const entryRef = doc(db, "logs", yearMonth, "entries", uid);
  let hasRendered = false;
  let hasUsedInitialStats = false;
  let userJoinDate = undefined;

  function onMarkToggled(entry) {
    const stats = computeStatsFromEntry(entry, yearMonth);
    if (isCurrentMonth) refreshBannerInPlace(container, entry, todayDate);
    refreshSummaryInPlace(container, entry, stats, yearMonth, isCurrentMonth);
    if (isMobile()) {
      const existingCard = container.querySelector(".cal-card");
      if (existingCard) {
        existingCard.replaceWith(renderMobileCard(entry, yearMonth, currentUser, { onMarkToggled }));
      }
    } else {
      const existingSection = container.querySelector(".tracker-section");
      if (existingSection) {
        existingSection.replaceWith(
          renderUserSection(entry, yearMonth, currentUser, isCurrentMonth, todayDate, onMarkToggled)
        );
      }
    }
  }

  unsubscribe = onSnapshot(entryRef, async (docSnap) => {

    if (hasRendered && docSnap.metadata.hasPendingWrites) return;

    if (!docSnap.exists() || !docSnap.data().activities?.length) {
      hideLoader();
      container.innerHTML = `<p class="empty-state">No tracker set up for this month yet.</p>`;
      hasRendered = true;
      return;
    }

    const entry = { id: uid, ...docSnap.data() };

    if (!entry.displayName || userJoinDate === undefined) {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (!userSnap.exists()) { hideLoader(); return; }
      const userData = userSnap.data();
      if (!entry.displayName) entry.displayName = userData.displayName;
      if (userJoinDate === undefined) {
        userJoinDate = userData.createdAt ? userData.createdAt.toDate() : null;
      }
    }
    entry.joinDate = userJoinDate;

    const user = auth.currentUser;

    if (!hasRendered) {
      container.innerHTML = "";

      if (isMobile()) {
        if (isCurrentMonth) {
          container.appendChild(renderStatusBanner(entry, todayDate));
        }
        container.appendChild(
          renderMobileCard(entry, yearMonth, user, { onMarkToggled })
        );
        const stats = (!hasUsedInitialStats && initialStatsPromise)
          ? await initialStatsPromise
          : await getUserStats(uid, yearMonth);
        hasUsedInitialStats = true;
        container.appendChild(renderMonthlySummary(entry, stats, yearMonth, isCurrentMonth));
      } else {
        const centeredStack = document.createElement("div");
        centeredStack.className = "mylog-centered-stack";
        if (isCurrentMonth) {
          centeredStack.appendChild(renderStatusBanner(entry, todayDate));
        }
        centeredStack.appendChild(
          renderUserSection(entry, yearMonth, user, isCurrentMonth, todayDate, onMarkToggled)
        );
        const stats = (!hasUsedInitialStats && initialStatsPromise)
          ? await initialStatsPromise
          : await getUserStats(uid, yearMonth);
        hasUsedInitialStats = true;

        window._currentEntry = entry;

        const bottomRow = document.createElement("div");
        bottomRow.className = "mylog-bottom-row";

        const progressCol = document.createElement("div");
        progressCol.className = "mylog-progress-col";
        progressCol.appendChild(renderMonthlySummary(entry, stats, yearMonth, isCurrentMonth));

        const diaryCol = document.createElement("div");
        diaryCol.className = "mylog-diary-col";
        renderDiaryNotebook(uid, yearMonth).then(nb => diaryCol.appendChild(nb));

        bottomRow.appendChild(progressCol);
        bottomRow.appendChild(diaryCol);
        centeredStack.appendChild(bottomRow);
        container.appendChild(centeredStack);
      }

      hasRendered = true;
      hideLoader();
      return;
    }

    const stats = computeStatsFromEntry(entry, yearMonth);
    if (isCurrentMonth) refreshBannerInPlace(container, entry, todayDate);
    refreshSummaryInPlace(container, entry, stats, yearMonth, isCurrentMonth);

  }, (error) => {
    console.error("Snapshot error:", error);
    showToast("Failed to load tracker.", "error");
    hideLoader();
  });
}

function refreshBannerInPlace(container, entry, todayDate) {
  const existing = container.querySelector(".status-banner");
  if (!existing) return;
  existing.replaceWith(renderStatusBanner(entry, todayDate));
}

function refreshSummaryInPlace(container, entry, stats, yearMonth, isCurrentMonth) {
  const existing = container.querySelector(".summary-card");
  if (!existing) return;
  const existingStreaks = {};
  existing.querySelectorAll(".summary-habit-streak[data-habit]").forEach(el => {
    existingStreaks[el.dataset.habit] = parseInt(el.dataset.streak || "0", 10);
  });
  if (stats.habitStats) {
    stats.habitStats.forEach(h => {
      if (h.habitStreak === 0 && existingStreaks[h.name] != null) {
        h.habitStreak = existingStreaks[h.name];
      }
    });
  }
  existing.replaceWith(renderMonthlySummary(entry, stats, yearMonth, isCurrentMonth));
}

const STATUS_BANNER_MESSAGES = {
  noneLogged: [
    "Hey, busy is not an excuse \u2014 no one's weak here, right?!",
    "No logs yet today. Start now and set the tone.",
    "Clock is ticking. Show up and make today count."
  ],
  someLogged: [
    "Good job! Let's get it!",
    "Nice start. Keep stacking wins today.",
    "You're in motion now \u2014 keep going."
  ],
  allDone: [
    "All habits done. Elite consistency.",
    "Perfect day. That's how it's done.",
    "Every habit checked off. You're on fire."
  ]
};

function pickBannerMessage(stateKey, todayDate, completedToday, totalHabits) {
  const pool = STATUS_BANNER_MESSAGES[stateKey] || STATUS_BANNER_MESSAGES.someLogged;
  const seed = `${stateKey}|${todayDate}|${completedToday}|${totalHabits}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return pool[Math.abs(hash) % pool.length];
}

function renderStatusBanner(entry, todayDate) {
  const activities = entry.activities || [];
  const marks      = entry.marks      || {};

  const pending = activities.filter(a => !(marks[a] || []).includes(todayDate));
  const completedToday = activities.length - pending.length;
  const allDone = pending.length === 0;
  const noneLogged = completedToday === 0;
  const stateKey = allDone ? "allDone" : (noneLogged ? "noneLogged" : "someLogged");

  const banner = document.createElement("div");
  banner.className = `status-banner ${allDone ? "status-banner--done" : "status-banner--pending"}`;

  const statusIcon = allDone ? "\ud83c\udf89" : icon('flame', 22);
  const title = allDone
    ? "Good job, you showed up today!"
    : noneLogged
      ? "Let's kick off today."
      : "Keep the momentum rolling.";
  const sub = pickBannerMessage(stateKey, todayDate, completedToday, activities.length);
  const pill = allDone ? "All done!" : `${pending.length} left`;

  banner.innerHTML = `
    <span class="status-banner__icon">${statusIcon}</span>
    <div class="status-banner__body">
      <strong class="status-banner__title">${title}</strong>
      <span class="status-banner__sub">${sub}</span>
    </div>
    <span class="status-banner__pill">${pill}</span>
  `;
  return banner;
}

// ─── RENDER ONE USER SECTION (desktop My Log) ─────────────
function renderUserSection(entry, yearMonth, currentUser, isCurrentMonth, todayDate, onMarkToggled) {
  const isOwner = currentUser && currentUser.uid === entry.id;
  const daysInMonth = getDaysInMonth(yearMonth);
  const { color, fontColor, font, sticker, marker, avatarUrl } = entry.decoration;

  const [year, month] = yearMonth.split("-").map(Number);
  let joinDay = null;
  let joinedThisMonth = false;
  const entryJoinDate = entry.joinDate instanceof Date ? entry.joinDate
    : entry.joinDate ? new Date(entry.joinDate) : null;
  if (entryJoinDate) {
    const joinYM = `${entryJoinDate.getFullYear()}-${String(entryJoinDate.getMonth() + 1).padStart(2, "0")}`;
    if (joinYM === yearMonth) {
      joinDay = entryJoinDate.getDate();
      joinedThisMonth = true;
    }
  }
  if (joinDay == null && entry.setupDay > 3) {
    joinDay = entry.setupDay;
  }

  const section = document.createElement("div");
  section.className = "tracker-section";
  section.style.borderColor = color;

  const badge = document.createElement("div");
  badge.className = "tracker-badge";
  badge.style.background = color;
  badge.style.fontFamily = `'${font}', sans-serif`;
  badge.style.color = fontColor;
  const avatarHTML = avatarUrl
    ? `<img src="${avatarUrl}" class="badge-avatar" alt="avatar" />`
    : "";
  badge.innerHTML = `${avatarHTML}<span class="badge-name">${entry.displayName}</span><span class="badge-sticker">${renderSticker(sticker)}</span>`;
  section.appendChild(badge);

  if (isOwner && isCurrentMonth) {
    const gearBtn = document.createElement("button");
    gearBtn.className = "tracker-badge-gear";
    gearBtn.title = "Manage activities";
    gearBtn.textContent = "⛯";
    gearBtn.addEventListener("click", () => openManageActivitiesModal(entry, yearMonth, currentUser, onMarkToggled));
    section.appendChild(gearBtn);
  }

  const headerRow = document.createElement("div");
  headerRow.className = "tracker-header-row";
  headerRow.innerHTML = `<div class="activity-label"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    cell.className = "day-header";
    const isToday   = isCurrentMonth && d === todayDate;
    const isFuture  = isCurrentMonth && d > todayDate;
    const dow = new Date(year, month - 1, d).getDay();
    const isSunday  = dow === 0;
    if (isToday)  cell.classList.add("day-header-today");
    if (isFuture) cell.classList.add("day-header-future");
    if (isSunday) cell.classList.add("day-header-sunday");
    if (dow === 1)                   cell.classList.add("week-start");
    else if (dow >= 2 && dow <= 6)   cell.classList.add("week-mid");
    else                             cell.classList.add("week-end");
    const startSquare = (joinDay != null && d === joinDay)
      ? `<span class="day-start-square"></span>`
      : "";
    cell.innerHTML = `
      <span class="day-num${isToday ? " today" : ""}">${startSquare}${d}</span>
      <span class="day-label">${getDayLabel(yearMonth, d)}</span>`;
    headerRow.appendChild(cell);
  }
  section.appendChild(headerRow);

  const cadences = entry.cadences || entry.activities.map(() => 7);
  const marks    = entry.marks || {};

  entry.activities.forEach((activity, index) => {
    const markedDays    = marks[activity] || [];
    const activityColor = getActivityColor(index);
    const cad           = cadences[index] ?? 7;
    const row = renderActivityRow(
      activity, daysInMonth, markedDays,
      activityColor, marker, isOwner,
      yearMonth, entry.id,
      isCurrentMonth, todayDate, cad,
      entry, onMarkToggled
    );
    section.appendChild(row);
  });

  if (joinDay != null) {
    const legend = document.createElement("div");
    legend.className = "tracker-grid-legend";
    const startLabel = joinedThisMonth ? "Join day" : "Start day";
    legend.innerHTML = `
      <span class="tgl-item"><span class="tgl-square"></span>${startLabel}</span>
      <span class="tgl-item"><span class="tgl-sunday"></span>Sunday</span>
      <span class="tgl-item"><span class="tgl-week"></span>Full week</span>`;
    section.appendChild(legend);
  }

  return section;
  //Migoy taba!
}

function renderActivityRow(
  activity, daysInMonth, markedDays, activityColor, marker,
  isOwner, yearMonth, userId, isCurrentMonth, todayDate, cadence,
  entry, onMarkToggled
) {
  const row = document.createElement("div");
  row.className = "tracker-row";

  const label = document.createElement("div");
  label.className = "activity-label";
  const cadTag = `<span class="activity-cad-tag">${cadenceLabel(cadence)}</span>`;
  label.innerHTML = `
    <span class="activity-dot" style="background:${activityColor}"></span>
    <span class="activity-name-text">${activity}</span>
    ${cadTag}`;
  row.appendChild(label);

  const [ry, rm] = yearMonth.split("-").map(Number);
  for (let d = 1; d <= daysInMonth; d++) {
    const cell    = document.createElement("div");
    cell.className = "day-cell";
    const isToday  = isCurrentMonth && d === todayDate;
    const isFuture = isCurrentMonth && d > todayDate;
    if (isToday)  cell.classList.add("day-cell-today");
    if (isFuture) cell.classList.add("future");
    const dow = new Date(ry, rm - 1, d).getDay();
    if (dow === 1)                 cell.classList.add("week-start");
    else if (dow >= 2 && dow <= 6) cell.classList.add("week-mid");
    else                           cell.classList.add("week-end");

    const isMarked = markedDays.includes(d);
    if (isMarked) {
      cell.classList.add("marked");
      cell.style.background   = activityColor;
      cell.style.borderColor  = activityColor;
      cell.textContent        = MARKER_SYMBOLS[marker] || "\u25cf";
      cell.style.color        = "white";
    }

    if (isOwner && !isFuture) {
      cell.classList.add("clickable");
      cell.addEventListener("click", () =>
        toggleDay(cell, d, activity, markedDays, activityColor, marker, yearMonth, userId, entry, onMarkToggled)
      );
    }
    row.appendChild(cell);
  }
  return row;
}

async function toggleDay(
  cell, day, activity, markedDays, activityColor, marker,
  yearMonth, userId, entry, onMarkToggled
) {
  const isMarked = markedDays.includes(day);
  if (isMarked) {
    markedDays.splice(markedDays.indexOf(day), 1);
    cell.classList.remove("marked");
    cell.style.background = cell.style.borderColor = cell.style.color = "";
    cell.textContent = "";
  } else {
    markedDays.push(day);
    cell.classList.add("marked");
    cell.style.background  = activityColor;
    cell.style.borderColor = activityColor;
    cell.textContent       = MARKER_SYMBOLS[marker] || "\u25cf";
    cell.style.color       = "white";
  }

  if (entry) {
    if (!entry.marks) entry.marks = {};
    entry.marks[activity] = markedDays;
    if (onMarkToggled) onMarkToggled(entry);
  }

  try {
    const logRef  = doc(db, "logs", yearMonth, "entries", userId);
    const logSnap = await getDoc(logRef);
    if (logSnap.exists()) {
      await updateDoc(logRef, { [`marks.${activity}`]: markedDays });
    } else {
      await setDoc(logRef, { userId, yearMonth, marks: { [activity]: markedDays } });
    }
  } catch (error) {
    console.error("Error saving log:", error);
    showToast("Couldn't save. Try again.", "error");
  }
}
