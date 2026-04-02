import { db, auth } from "./firebase-config.js";
import {
  collection, doc, getDoc, setDoc,
  updateDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getDaysInMonth, getDayLabel, getCurrentYearMonth } from "./utils.js";
import { showToast, showLoader, hideLoader } from "./ui.js";
import { renderMobileCard } from "./mobile-tracker.js";

const MARKER_SYMBOLS = {
  circle:   "●",
  star:     "★",
  heart:    "♥",
  check:    "✓",
  x:        "✗",
  scribble: "〰"
};

// ─── Activity colors — auto-assigned by index ─────────
export const ACTIVITY_COLORS = [
  "#D8584E",  // coral    — activity 1
  "#80B9B9",  // teal     — activity 2
  "#F8C08A",  // amber    — activity 3
  "#A29BFE",  // lavender — activity 4
  "#1DD1A1",  // mint     — activity 5
];

export function getActivityColor(index) {
  return ACTIVITY_COLORS[index % ACTIVITY_COLORS.length];
}

// Detect mobile
function isMobile() {
  return window.innerWidth <= 768;
}

let unsubscribe = null;

// ─── LOAD MY LOG — current user only ─────────────────
export function loadMyLog(yearMonth, container, currentUser) {
  showLoader();
  container.innerHTML = "";

  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  const isCurrentMonth = yearMonth === getCurrentYearMonth();
  const todayDate = new Date().getDate();
  const uid = currentUser?.uid || auth.currentUser?.uid;

  if (!uid) {
    hideLoader();
    container.innerHTML = `<p class="empty-state">Not logged in.</p>`;
    return;
  }

  const entryRef = doc(db, "logs", yearMonth, "entries", uid);

  unsubscribe = onSnapshot(entryRef, async (docSnap) => {
    container.innerHTML = "";

    if (!docSnap.exists() || !docSnap.data().activities?.length) {
      hideLoader();
      container.innerHTML = `<p class="empty-state">No tracker set up for this month yet.</p>`;
      return;
    }

    const entry = { id: uid, ...docSnap.data() };

    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) {
      hideLoader();
      return;
    }
    entry.displayName = userSnap.data().displayName;

    const user = auth.currentUser;

    if (isMobile()) {
      const card = renderMobileCard(entry, yearMonth, user);
      container.appendChild(card);
    } else {
      const section = renderUserSection(entry, yearMonth, user, isCurrentMonth, todayDate);
      container.appendChild(section);
    }

    hideLoader();
  }, (error) => {
    console.error("Snapshot error:", error);
    showToast("Failed to load tracker.", "error");
    hideLoader();
  });
}

// ─── LOAD ALL LOGS — all users except self ────────────
export function loadAllLogs(yearMonth, container, currentUser) {
  showLoader();
  container.innerHTML = "";

  const entriesRef = collection(db, "logs", yearMonth, "entries");
  const isCurrentMonth = yearMonth === getCurrentYearMonth();
  const todayDate = new Date().getDate();

  return onSnapshot(entriesRef, async (snapshot) => {
    const entries = [];

    for (const docSnap of snapshot.docs) {
      // Skip the current user — they have their own Mine tab
      if (docSnap.id === currentUser?.uid) continue;

      const entry = { id: docSnap.id, ...docSnap.data() };
      if (!entry.activities || entry.activities.length === 0) continue;

      const userSnap = await getDoc(doc(db, "users", entry.id));
      if (!userSnap.exists()) continue;

      const userData = userSnap.data();
      entries.push({
        ...entry,
        displayName: userData.displayName,
        username: userData.username || userData.displayName,
      });
    }

    if (entries.length === 0) {
      hideLoader();
      container.innerHTML = `<p class="empty-state">No other trackers yet for this month.</p>`;
      return;
    }

    // Load current user's follows to decide button state
    let myFollows = new Set();
    if (currentUser?.uid) {
      try {
        const myUserSnap = await getDoc(doc(db, "users", currentUser.uid));
        if (myUserSnap.exists()) {
          const following = myUserSnap.data().following || [];
          myFollows = new Set(following);
        }
      } catch (e) {
        console.warn("Could not load follows:", e);
      }
    }

    container.innerHTML = "";

    // Followed users first, then alphabetical
    entries.sort((a, b) => {
      const aFollowed = myFollows.has(a.id);
      const bFollowed = myFollows.has(b.id);
      if (aFollowed && !bFollowed) return -1;
      if (!aFollowed && bFollowed) return 1;
      return (a.displayName || "").localeCompare(b.displayName || "");
    });

    for (const entry of entries) {
      const isFollowing = myFollows.has(entry.id);
      const card = renderMobileCard(entry, yearMonth, currentUser, { isFollowing, showFollowBtn: true });
      container.appendChild(card);
    }

    hideLoader();
  }, (error) => {
    console.error("Snapshot error:", error);
    showToast("Failed to load trackers.", "error");
    hideLoader();
  });
}

// ─── RENDER ONE USER SECTION (desktop) ────────────────
function renderUserSection(entry, yearMonth, currentUser, isCurrentMonth, todayDate) {
  const isOwner = currentUser && currentUser.uid === entry.id;
  const daysInMonth = getDaysInMonth(yearMonth);
  const { color, fontColor, font, sticker, marker, avatarUrl } = entry.decoration;

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

  badge.innerHTML = `
    ${avatarHTML}
    <span class="badge-name">${entry.displayName}</span>
    <span class="badge-sticker">${sticker}</span>
  `;
  section.appendChild(badge);

  const headerRow = document.createElement("div");
  headerRow.className = "tracker-header-row";
  headerRow.innerHTML = `<div class="activity-label"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    cell.className = "day-header";
    const isToday = isCurrentMonth && d === todayDate;
    const isFutureHeader = isCurrentMonth && d > todayDate;
    if (isToday) cell.classList.add("day-header-today");
    if (isFutureHeader) cell.classList.add("day-header-future");
    cell.innerHTML = `
      <span class="day-num${isToday ? ' today' : ''}">${d}</span>
      <span class="day-label">${getDayLabel(yearMonth, d)}</span>
    `;
    headerRow.appendChild(cell);
  }
  section.appendChild(headerRow);

  const marks = entry.marks || {};
  entry.activities.forEach((activity, index) => {
    const markedDays = marks[activity] || [];
    const activityColor = getActivityColor(index);
    const row = renderActivityRow(
      activity, daysInMonth, markedDays,
      activityColor, marker, isOwner,
      yearMonth, entry.id,
      isCurrentMonth, todayDate
    );
    section.appendChild(row);
  });

  return section;
}

// ─── RENDER ONE ACTIVITY ROW (desktop) ────────────────
function renderActivityRow(activity, daysInMonth, markedDays, activityColor, marker, isOwner, yearMonth, userId, isCurrentMonth, todayDate) {
  const row = document.createElement("div");
  row.className = "tracker-row";

  const label = document.createElement("div");
  label.className = "activity-label";
  label.innerHTML = `
    <span class="activity-dot" style="background:${activityColor}"></span>
    <span>${activity}</span>
  `;
  row.appendChild(label);

  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    cell.className = "day-cell";

    const isToday = isCurrentMonth && d === todayDate;
    const isFuture = isCurrentMonth && d > todayDate;

    if (isToday) cell.classList.add("day-cell-today");
    if (isFuture) cell.classList.add("future");

    const isMarked = markedDays.includes(d);
    if (isMarked) {
      cell.classList.add("marked");
      cell.style.background = activityColor;
      cell.style.borderColor = activityColor;
      cell.textContent = MARKER_SYMBOLS[marker] || "●";
      cell.style.color = "white";
    }

    if (isOwner && !isFuture) {
      cell.classList.add("clickable");
      cell.addEventListener("click", () =>
        toggleDay(cell, d, activity, markedDays, activityColor, marker, yearMonth, userId)
      );
    }

    row.appendChild(cell);
  }

  return row;
}

// ─── TOGGLE A DAY (desktop) ─────────────────────────
async function toggleDay(cell, day, activity, markedDays, activityColor, marker, yearMonth, userId) {
  const isMarked = markedDays.includes(day);

  if (isMarked) {
    markedDays.splice(markedDays.indexOf(day), 1);
    cell.classList.remove("marked");
    cell.style.background = "";
    cell.style.borderColor = "";
    cell.textContent = "";
    cell.style.color = "";
  } else {
    markedDays.push(day);
    cell.classList.add("marked");
    cell.style.background = activityColor;
    cell.style.borderColor = activityColor;
    cell.textContent = MARKER_SYMBOLS[marker] || "●";
    cell.style.color = "white";
  }

  try {
    const logRef = doc(db, "logs", yearMonth, "entries", userId);
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
