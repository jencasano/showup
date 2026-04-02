import { db, auth } from "./firebase-config.js";
import {
  collection, doc, getDoc, setDoc,
  updateDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getDaysInMonth, getDayLabel, getCurrentYearMonth } from "./utils.js";
import { showToast, showLoader, hideLoader } from "./ui.js";
import { renderMobileCard } from "./mobile-tracker.js";
import { getUserStats, cadenceLabel } from "./stats.js";

const MARKER_SYMBOLS = {
  circle:   "●",
  star:     "★",
  heart:    "♥",
  check:    "✓",
  x:        "✗",
  scribble: "〰"
};

export const ACTIVITY_COLORS = [
  "#D8584E",
  "#80B9B9",
  "#F8C08A",
  "#A29BFE",
  "#1DD1A1",
];

export function getActivityColor(index) {
  return ACTIVITY_COLORS[index % ACTIVITY_COLORS.length];
}

function isMobile() {
  return window.innerWidth <= 768;
}

let unsubscribe = null;

// ─── LOAD MY LOG ──────────────────────────────────────────
export function loadMyLog(yearMonth, container, currentUser) {
  showLoader();
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
      // ── Mobile: banner + card + summary ─────────────────
      if (isCurrentMonth) {
        const banner = renderStatusBanner(entry, todayDate, true);
        container.appendChild(banner);
      }

      const card = renderMobileCard(entry, yearMonth, user);
      container.appendChild(card);

      const stats = await getUserStats(uid, yearMonth);
      const summary = renderMonthlySummary(entry, stats, yearMonth);
      container.appendChild(summary);
    } else {
      // ── Desktop: banner + tracker grid + summary ─────────
      if (isCurrentMonth) {
        const banner = renderStatusBanner(entry, todayDate, false);
        container.appendChild(banner);
      }

      const section = renderUserSection(entry, yearMonth, user, isCurrentMonth, todayDate);
      container.appendChild(section);

      const stats = await getUserStats(uid, yearMonth);
      const summary = renderMonthlySummary(entry, stats, yearMonth);
      container.appendChild(summary);
    }

    hideLoader();
  }, (error) => {
    console.error("Snapshot error:", error);
    showToast("Failed to load tracker.", "error");
    hideLoader();
  });
}

// ─── TODAY'S STATUS BANNER ────────────────────────────────
function renderStatusBanner(entry, todayDate, isMob) {
  const activities = entry.activities || [];
  const cadences   = entry.cadences   || activities.map(() => 7);
  const marks      = entry.marks      || {};

  // Which activities have NOT been logged today?
  const pending = activities.filter(a => !(marks[a] || []).includes(todayDate));
  const allDone = pending.length === 0;

  const banner = document.createElement("div");
  banner.className = `status-banner ${allDone ? "status-banner--done" : "status-banner--pending"}`;

  const icon  = allDone ? "🎉" : "🔥";
  const title = allDone
    ? "Good job, you showed up today!"
    : "Log a completed habit for today!";
  const sub = allDone
    ? `All ${activities.length} habit${activities.length !== 1 ? "s" : ""} logged. Keep the streak alive!`
    : `${pending.length} habit${pending.length !== 1 ? "s" : ""} left — ${pending.slice(0, isMob ? 1 : 2).join(", ")}${pending.length > (isMob ? 1 : 2) ? " & more" : ""}.`;
  const pill = allDone ? "All done!" : `${pending.length} left`;

  banner.innerHTML = `
    <span class="status-banner__icon">${icon}</span>
    <div class="status-banner__body">
      <strong class="status-banner__title">${title}</strong>
      <span class="status-banner__sub">${sub}</span>
    </div>
    <span class="status-banner__pill">${pill}</span>
  `;

  return banner;
}

// ─── MONTHLY SUMMARY CARD ─────────────────────────────────
function renderMonthlySummary(entry, stats, yearMonth) {
  const { overallRate, streak, doneThisMonth, habitStats } = stats;
  const activities = entry.activities || [];
  const cadences   = entry.cadences   || activities.map(() => 7);

  const card = document.createElement("div");
  card.className = "summary-card";

  // Per-habit bars HTML
  const barsHTML = habitStats.map((h, i) => {
    const color = getActivityColor(i);
    const barColor = h.rate >= 80 ? "var(--color-success, #22C55E)"
                   : h.rate >= 50 ? "var(--color-warning, #F59E0B)"
                   : "var(--color-danger, #EF4444)";
    return `
      <div class="summary-habit-row">
        <div class="summary-habit-top">
          <span class="summary-habit-name">
            <span class="summary-habit-dot" style="background:${color}"></span>
            ${h.name}
          </span>
          <div class="summary-habit-meta">
            <span class="summary-habit-cad">${h.cadenceLabel}</span>
            <span class="summary-habit-pct" style="color:${barColor}">${h.rate}%</span>
          </div>
        </div>
        <div class="summary-habit-track">
          <div class="summary-habit-fill" style="width:${h.rate}%;background:${barColor}"></div>
        </div>
        <div class="summary-habit-sub">${h.thisWeekLogged} of ${h.thisWeekTarget} logged this week</div>
      </div>`;
  }).join("");

  card.innerHTML = `
    <div class="summary-card__header">
      <div>
        <div class="summary-card__title">Monthly Summary</div>
        <div class="summary-card__sub">Equal-weighted across ${activities.length} habit${activities.length !== 1 ? "s" : ""}</div>
      </div>
      <button class="summary-share-btn" title="Share your stats">↗ Share</button>
    </div>

    <div class="summary-stats">
      <div class="summary-stat">
        <span class="summary-stat__icon">✅</span>
        <div class="summary-stat__val">${overallRate}<span class="summary-stat__unit">%</span></div>
        <div class="summary-stat__label">Overall Rate</div>
      </div>
      <div class="summary-stat">
        <span class="summary-stat__icon">🔥</span>
        <div class="summary-stat__val">${streak}<span class="summary-stat__unit">wk</span></div>
        <div class="summary-stat__label">Streak</div>
      </div>
      <div class="summary-stat">
        <span class="summary-stat__icon">📅</span>
        <div class="summary-stat__val">${doneThisMonth}</div>
        <div class="summary-stat__label">Days Logged</div>
      </div>
    </div>

    <div class="summary-note">
      <strong>How is this calculated?</strong>
      Each habit's fulfillment is averaged equally — so a daily habit doesn't outweigh a 2×/week habit.
    </div>

    <div class="summary-habits">
      <div class="summary-habits__label">Per Habit</div>
      ${barsHTML}
    </div>
  `;

  // Share button — basic text share for now
  card.querySelector(".summary-share-btn").addEventListener("click", () => {
    const text = `My showup. stats for this month:\n✅ ${overallRate}% overall rate\n🔥 ${streak} week streak\n${habitStats.map(h => `• ${h.name}: ${h.rate}%`).join("\n")}`;
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => showToast("Stats copied!", "info"));
    }
  });

  return card;
}

// ─── LOAD ALL LOGS ────────────────────────────────────────
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

    let myFollows = new Set();
    if (currentUser?.uid) {
      try {
        const myUserSnap = await getDoc(doc(db, "users", currentUser.uid));
        if (myUserSnap.exists()) {
          myFollows = new Set(myUserSnap.data().following || []);
        }
      } catch (e) { console.warn("Could not load follows:", e); }
    }

    container.innerHTML = "";
    entries.sort((a, b) => {
      const aF = myFollows.has(a.id), bF = myFollows.has(b.id);
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

// ─── LOAD FOLLOWING LOGS ─────────────────────────────────
export function loadFollowingLogs(yearMonth, container, currentUser, onSwitchToAll) {
  showLoader();
  container.innerHTML = "";

  if (!currentUser?.uid) {
    hideLoader();
    container.innerHTML = `<p class="empty-state">Not logged in.</p>`;
    return () => {};
  }

  let logUnsubMap = {};
  const myRef = doc(db, "users", currentUser.uid);

  const unsubMe = onSnapshot(myRef, async (mySnap) => {
    if (!mySnap.exists()) { renderFollowingEmpty(container, onSwitchToAll); hideLoader(); return; }

    const followingIds = mySnap.data().following || [];
    const statEl = document.getElementById("month-bar-stat");
    if (statEl) {
      statEl.textContent = followingIds.length > 0
        ? `Following ${followingIds.length} ${followingIds.length === 1 ? "person" : "people"} this month`
        : "";
    }

    if (followingIds.length === 0) {
      Object.values(logUnsubMap).forEach(u => u());
      logUnsubMap = {};
      renderFollowingEmpty(container, onSwitchToAll);
      hideLoader();
      return;
    }

    const newIds = new Set(followingIds);
    const oldIds = new Set(Object.keys(logUnsubMap));

    for (const uid of oldIds) {
      if (!newIds.has(uid)) {
        logUnsubMap[uid]();
        delete logUnsubMap[uid];
        container.querySelector(`[data-uid="${uid}"]`)?.remove();
      }
    }

    container.querySelector(".following-nudge-slot")?.remove();

    for (const uid of newIds) {
      if (oldIds.has(uid)) continue;
      let userData;
      try {
        const userSnap = await getDoc(doc(db, "users", uid));
        if (!userSnap.exists()) continue;
        userData = userSnap.data();
      } catch (e) { continue; }

      const slot = document.createElement("div");
      slot.dataset.uid = uid;
      slot.className = "following-card-slot";
      container.appendChild(slot);

      const logRef = doc(db, "logs", yearMonth, "entries", uid);
      const unsubLog = onSnapshot(logRef, (logSnap) => {
        slot.innerHTML = "";
        if (!logSnap.exists() || !logSnap.data().activities?.length) {
          slot.appendChild(renderPlaceholderCard(userData));
          hideLoader();
          return;
        }
        const entry = { id: uid, ...logSnap.data(), displayName: userData.displayName };
        slot.appendChild(renderMobileCard(entry, yearMonth, currentUser, { isFollowing: true, showFollowBtn: true }));
        hideLoader();
      }, (err) => { console.error("Log snapshot error:", err); hideLoader(); });

      logUnsubMap[uid] = unsubLog;
    }

    appendNudgeCard(container, onSwitchToAll);
    if (container.children.length === 0) showLoader();
    else hideLoader();

  }, (err) => {
    console.error("User snapshot error:", err);
    showToast("Failed to load following.", "error");
    hideLoader();
  });

  return () => {
    unsubMe();
    Object.values(logUnsubMap).forEach(u => u());
    logUnsubMap = {};
  };
}

function renderFollowingEmpty(container, onSwitchToAll) {
  container.innerHTML = `
    <div class="following-empty">
      <div class="following-empty-icon">👥</div>
      <h3 class="following-empty-title">Follow more people</h3>
      <p class="following-empty-sub">Visit the All tab to discover and follow other trackers</p>
      <button class="following-browse-btn" id="browse-all-btn">Browse All →</button>
    </div>`;
  container.querySelector("#browse-all-btn")?.addEventListener("click", onSwitchToAll);
}

function appendNudgeCard(container, onSwitchToAll) {
  const slot = document.createElement("div");
  slot.className = "following-nudge-slot";
  slot.innerHTML = `
    <div class="following-nudge-card">
      <div class="following-nudge-icon">👥</div>
      <p class="following-nudge-title">Follow more people</p>
      <p class="following-nudge-sub">Visit the All tab to discover and follow other trackers</p>
      <button class="following-browse-btn" id="nudge-browse-btn">Browse All →</button>
    </div>`;
  slot.querySelector("#nudge-browse-btn")?.addEventListener("click", onSwitchToAll);
  container.appendChild(slot);
}

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
    </div>`;
  return card;
}

// ─── RENDER ONE USER SECTION (desktop My Log) ─────────────
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
  badge.innerHTML = `${avatarHTML}<span class="badge-name">${entry.displayName}</span><span class="badge-sticker">${sticker}</span>`;
  section.appendChild(badge);

  const headerRow = document.createElement("div");
  headerRow.className = "tracker-header-row";
  headerRow.innerHTML = `<div class="activity-label"></div>`;
  const [year, month] = yearMonth.split("-").map(Number);
  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    cell.className = "day-header";
    const isToday   = isCurrentMonth && d === todayDate;
    const isFuture  = isCurrentMonth && d > todayDate;
    const isSunday  = new Date(year, month - 1, d).getDay() === 0;
    if (isToday)  cell.classList.add("day-header-today");
    if (isFuture) cell.classList.add("day-header-future");
    if (isSunday) cell.classList.add("day-header-sunday");
    cell.innerHTML = `
      <span class="day-num${isToday ? " today" : ""}">${d}</span>
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
      isCurrentMonth, todayDate, cad
    );
    section.appendChild(row);
  });

  return section;
  //Migoy taba!
}

// ─── RENDER ONE ACTIVITY ROW (desktop) ────────────────────
function renderActivityRow(activity, daysInMonth, markedDays, activityColor, marker, isOwner, yearMonth, userId, isCurrentMonth, todayDate, cadence) {
  const row = document.createElement("div");
  row.className = "tracker-row";

  const label = document.createElement("div");
  label.className = "activity-label";

  // Cadence tag inline with label
  const cadTag = `<span class="activity-cad-tag">${cadenceLabel(cadence)}</span>`;

  label.innerHTML = `
    <span class="activity-dot" style="background:${activityColor}"></span>
    <span class="activity-name-text">${activity}</span>
    ${cadTag}`;
  row.appendChild(label);

  for (let d = 1; d <= daysInMonth; d++) {
    const cell    = document.createElement("div");
    cell.className = "day-cell";
    const isToday  = isCurrentMonth && d === todayDate;
    const isFuture = isCurrentMonth && d > todayDate;
    if (isToday)  cell.classList.add("day-cell-today");
    if (isFuture) cell.classList.add("future");

    const isMarked = markedDays.includes(d);
    if (isMarked) {
      cell.classList.add("marked");
      cell.style.background   = activityColor;
      cell.style.borderColor  = activityColor;
      cell.textContent        = MARKER_SYMBOLS[marker] || "●";
      cell.style.color        = "white";
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

// ─── TOGGLE A DAY (desktop) ───────────────────────────────
async function toggleDay(cell, day, activity, markedDays, activityColor, marker, yearMonth, userId) {
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
    cell.textContent       = MARKER_SYMBOLS[marker] || "●";
    cell.style.color       = "white";
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
