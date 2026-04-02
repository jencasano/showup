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
    if (!userSnap.exists()) { hideLoader(); return; }
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

  return onSnapshot(entriesRef, async (snapshot) => {
    const entries = [];

    for (const docSnap of snapshot.docs) {
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

    // Load current user's follows for button state
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
      const aF = myFollows.has(a.id);
      const bF = myFollows.has(b.id);
      if (aF && !bF) return -1;
      if (!aF && bF) return 1;
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

// ─── LOAD FOLLOWING LOGS — real-time ─────────────────
// Watches the current user's own doc for changes to their
// `following` array. When it changes, tears down and rebuilds
// individual onSnapshot listeners for each followed user's
// log entry — so card data is also live.
//
// Returns an unsubscribe function that cleans everything up.
export function loadFollowingLogs(yearMonth, container, currentUser, onSwitchToAll) {
  showLoader();
  container.innerHTML = "";

  if (!currentUser?.uid) {
    hideLoader();
    container.innerHTML = `<p class="empty-state">Not logged in.</p>`;
    return () => {};
  }

  // Per-followed-user log listeners — torn down whenever the
  // following list changes so we don't accumulate orphan listeners.
  let logUnsubMap = {};

  // ── Watch THIS user's profile doc for following array changes ──
  const myRef = doc(db, "users", currentUser.uid);
  const unsubMe = onSnapshot(myRef, async (mySnap) => {
    if (!mySnap.exists()) {
      renderEmpty(container, onSwitchToAll);
      hideLoader();
      return;
    }

    const followingIds = mySnap.data().following || [];

    // Update month-bar stat (Following X people)
    const statEl = document.getElementById("month-bar-stat");
    if (statEl) {
      statEl.textContent = followingIds.length > 0
        ? `Following ${followingIds.length} ${followingIds.length === 1 ? "person" : "people"} this month`
        : "";
    }

    if (followingIds.length === 0) {
      // Tear down any old log listeners and show empty state
      Object.values(logUnsubMap).forEach(u => u());
      logUnsubMap = {};
      renderEmpty(container, onSwitchToAll);
      hideLoader();
      return;
    }

    // Figure out which uids were added / removed since last snapshot
    const newIds = new Set(followingIds);
    const oldIds = new Set(Object.keys(logUnsubMap));

    // Remove listeners for unfollowed users
    for (const uid of oldIds) {
      if (!newIds.has(uid)) {
        logUnsubMap[uid]();
        delete logUnsubMap[uid];
        // Remove their card from DOM
        container.querySelector(`[data-uid="${uid}"]`)?.remove();
      }
    }

    // Add listeners for newly followed users
    for (const uid of newIds) {
      if (oldIds.has(uid)) continue; // already listening

      // Fetch user profile once
      let userData;
      try {
        const userSnap = await getDoc(doc(db, "users", uid));
        if (!userSnap.exists()) continue;
        userData = userSnap.data();
      } catch (e) {
        console.warn("Could not fetch user:", uid, e);
        continue;
      }

      // Create a placeholder slot so cards stay in follow-order
      const slot = document.createElement("div");
      slot.dataset.uid = uid;
      slot.className = "following-card-slot";
      container.appendChild(slot);

      // Watch their log entry live
      const logRef = doc(db, "logs", yearMonth, "entries", uid);
      const unsubLog = onSnapshot(logRef, (logSnap) => {
        slot.innerHTML = "";

        if (!logSnap.exists() || !logSnap.data().activities?.length) {
          // They haven't set up a tracker this month — show a placeholder card
          const placeholder = renderPlaceholderCard(userData);
          slot.appendChild(placeholder);
          hideLoader();
          return;
        }

        const entry = {
          id: uid,
          ...logSnap.data(),
          displayName: userData.displayName,
        };

        const card = renderMobileCard(entry, yearMonth, currentUser, {
          isFollowing: true,
          showFollowBtn: true,
        });
        slot.appendChild(card);
        hideLoader();
      }, (err) => {
        console.error("Log snapshot error:", err);
        hideLoader();
      });

      logUnsubMap[uid] = unsubLog;
    }

    // If container is still empty (all placeholders pending), show loader
    if (container.children.length === 0) showLoader();
    else hideLoader();

  }, (err) => {
    console.error("User snapshot error:", err);
    showToast("Failed to load following.", "error");
    hideLoader();
  });

  // Return a cleanup function
  return () => {
    unsubMe();
    Object.values(logUnsubMap).forEach(u => u());
    logUnsubMap = {};
  };
}

// ─── RENDER EMPTY STATE ───────────────────────────────
function renderEmpty(container, onSwitchToAll) {
  container.innerHTML = `
    <div class="following-empty">
      <div class="following-empty-icon">👥</div>
      <h3 class="following-empty-title">Follow more people</h3>
      <p class="following-empty-sub">Visit the All tab to discover and follow other trackers</p>
      <button class="following-browse-btn" id="browse-all-btn">Browse All →</button>
    </div>
  `;
  container.querySelector("#browse-all-btn")?.addEventListener("click", onSwitchToAll);
}

// ─── RENDER PLACEHOLDER CARD (no tracker this month) ──
function renderPlaceholderCard(userData) {
  const { color = "#80B9B9", fontColor = "white", font = "Inter", sticker = "✨", avatarUrl } = userData.decoration || {};
  const card = document.createElement("div");
  card.className = "cal-card cal-card-placeholder";
  card.style.borderColor = color;

  const avatarHTML = avatarUrl
    ? `<img src="${avatarUrl}" class="cal-card-avatar" alt="avatar" />`
    : `<div class="cal-card-avatar-initials">${(userData.displayName || "?").charAt(0).toUpperCase()}</div>`;

  card.innerHTML = `
    <div class="cal-card-badge" style="background:${color};color:${fontColor};font-family:'${font}',sans-serif;">
      <div class="cal-card-avatar-wrap">${avatarHTML}</div>
      <div class="cal-card-name-wrap">
        <span class="cal-card-name">${userData.displayName}</span>
        <span class="cal-card-sticker">${sticker}</span>
      </div>
    </div>
    <div class="cal-card-placeholder-body">
      <span class="cal-card-placeholder-text">No tracker set up this month yet</span>
    </div>
  `;
  return card;
}

// ─── RENDER ONE USER SECTION (desktop My Log) ─────────
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

// ─── TOGGLE A DAY (desktop) ──────────────────────────
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
