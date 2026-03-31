import { db, auth } from "./firebase-config.js";
import {
  collection, getDocs, doc, getDoc,
  setDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getDaysInMonth, getDayLabel, formatYearMonth } from "./utils.js";
import { showToast, showLoader, hideLoader } from "./ui.js";

const MARKER_SYMBOLS = {
  circle: "●",
  star: "★",
  heart: "♥",
  check: "✓",
  x: "✗",
  scribble: "〰"
};

// ─── LOAD AND RENDER TRACKER ─────────────────────────
export async function loadTracker(yearMonth, container) {
  showLoader();
  container.innerHTML = "";

  try {
    // Fetch all users
    const usersSnap = await getDocs(collection(db, "users"));
    const users = [];
    usersSnap.forEach(d => users.push({ id: d.id, ...d.data() }));

    if (users.length === 0) {
      container.innerHTML = `<p class="empty-state">No trackers yet. Be the first to sign up!</p>`;
      hideLoader();
      return;
    }

    // Render month heading
    const heading = document.createElement("h2");
    heading.className = "month-heading";
    heading.textContent = formatYearMonth(yearMonth);
    container.appendChild(heading);

    // Render each user's section
    for (const user of users) {
      const logs = await getUserLogs(yearMonth, user.id);
      const section = renderUserSection(user, yearMonth, logs);
      container.appendChild(section);
    }

  } catch (error) {
    console.error("Error loading tracker:", error);
    showToast("Failed to load tracker.", "error");
  }

  hideLoader();
}

// ─── FETCH A USER'S LOGS FOR A MONTH ─────────────────
async function getUserLogs(yearMonth, userId) {
  try {
    const logDoc = await getDoc(
      doc(db, "logs", yearMonth, "entries", userId)
    );
    return logDoc.exists() ? logDoc.data().marks || {} : {};
  } catch {
    return {};
  }
}

// ─── RENDER ONE USER SECTION ─────────────────────────
function renderUserSection(user, yearMonth, logs) {
  const currentUser = auth.currentUser;
  const isOwner = currentUser && currentUser.uid === user.id;
  const daysInMonth = getDaysInMonth(yearMonth);
  const { color, font, sticker, marker } = user.decoration;

  // Wrapper
  const section = document.createElement("div");
  section.className = "tracker-section";
  section.style.borderColor = color;

  // Name badge
  const badge = document.createElement("div");
  badge.className = "tracker-badge";
  badge.style.background = color;
  badge.style.fontFamily = `'${font}', sans-serif`;
  badge.innerHTML = `<span>${sticker}</span> <span>${user.displayName}</span>`;
  section.appendChild(badge);

  // Day headers row
  const headerRow = document.createElement("div");
  headerRow.className = "tracker-header-row";
  headerRow.innerHTML = `<div class="activity-label"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    cell.className = "day-header";
    cell.innerHTML = `<span class="day-num">${d}</span><span class="day-label">${getDayLabel(yearMonth, d)}</span>`;
    headerRow.appendChild(cell);
  }
  section.appendChild(headerRow);

  // One row per activity
  for (const activity of user.activities) {
    const row = renderActivityRow(
      activity, daysInMonth, logs[activity] || [],
      color, marker, isOwner,
      yearMonth, user.id
    );
    section.appendChild(row);
  }

  return section;
}

// ─── RENDER ONE ACTIVITY ROW ─────────────────────────
function renderActivityRow(activity, daysInMonth, markedDays, color, marker, isOwner, yearMonth, userId) {
  const row = document.createElement("div");
  row.className = "tracker-row";

  // Activity label
  const label = document.createElement("div");
  label.className = "activity-label";
  label.textContent = activity;
  row.appendChild(label);

  // Day circles
  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    cell.className = "day-cell";

    const isMarked = markedDays.includes(d);
    if (isMarked) {
      cell.classList.add("marked");
      cell.style.background = color;
      cell.style.borderColor = color;
      cell.textContent = MARKER_SYMBOLS[marker] || "●";
      cell.style.color = "white";
    }

    // Only owner can toggle
    if (isOwner) {
      cell.classList.add("clickable");
      cell.addEventListener("click", () =>
        toggleDay(cell, d, activity, markedDays, color, marker, yearMonth, userId)
      );
    }

    row.appendChild(cell);
  }

  return row;
}

// ─── TOGGLE A DAY ────────────────────────────────────
async function toggleDay(cell, day, activity, markedDays, color, marker, yearMonth, userId) {
  const isMarked = markedDays.includes(day);

  // Optimistic UI update
  if (isMarked) {
    markedDays.splice(markedDays.indexOf(day), 1);
    cell.classList.remove("marked");
    cell.style.background = "";
    cell.style.borderColor = "";
    cell.textContent = "";
  } else {
    markedDays.push(day);
    cell.classList.add("marked");
    cell.style.background = color;
    cell.style.borderColor = color;
    cell.textContent = MARKER_SYMBOLS[marker] || "●";
    cell.style.color = "white";
  }

  // Persist to Firestore
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