import { db, auth } from "./firebase-config.js";
import {
  collection, doc, getDoc, setDoc,
  updateDoc, onSnapshot, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getDaysInMonth, getDayLabel, getCurrentYearMonth } from "./utils.js";
import { showToast, showLoader, hideLoader } from "./ui.js";
import { renderMobileCard } from "./mobile-tracker.js";
import { getUserStats, computeStatsFromEntry, cadenceLabel } from "./stats.js";

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
export function loadMyLog(yearMonth, container, currentUser, initialStatsPromise = null) {
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
  let hasRendered = false;
  let hasUsedInitialStats = false;

  function onMarkToggled(entry) {
    const stats = computeStatsFromEntry(entry, yearMonth);
    if (isCurrentMonth) refreshBannerInPlace(container, entry, todayDate);
    refreshSummaryInPlace(container, entry, stats, yearMonth, isCurrentMonth);
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

    if (!entry.displayName) {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (!userSnap.exists()) { hideLoader(); return; }
      entry.displayName = userSnap.data().displayName;
    }

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
        centeredStack.appendChild(renderMonthlySummary(entry, stats, yearMonth, isCurrentMonth));
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

// ─── PATCH: replace status banner node in-place ───────────
function refreshBannerInPlace(container, entry, todayDate) {
  const existing = container.querySelector(".status-banner");
  if (!existing) return;
  existing.replaceWith(renderStatusBanner(entry, todayDate));
}

// ─── PATCH: replace summary card node in-place ────────────
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

// ─── TODAY'S STATUS BANNER ────────────────────────────────
const STATUS_BANNER_MESSAGES = {
  noneLogged: [
    "Hey, busy is not an excuse — no one's weak here, right?!",
    "No logs yet today. Start now and set the tone.",
    "Clock is ticking. Show up and make today count."
  ],
  someLogged: [
    "Good job! Let's get it!",
    "Nice start. Keep stacking wins today.",
    "You're in motion now — keep going."
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

  const icon  = allDone ? "🎉" : "🔥";
  const title = allDone
    ? "Good job, you showed up today!"
    : noneLogged
      ? "Let's kick off today."
      : "Keep the momentum rolling.";
  const sub = pickBannerMessage(stateKey, todayDate, completedToday, activities.length);
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

// ─── PROGRESS SUMMARY CARD ────────────────────────────────
function renderMonthlySummary(entry, stats, yearMonth, isCurrentMonth) {
  const { showUpDays = 0, perfectDays = 0, totalThisMonth, habitStats, monthlyTargetHitRate, fullWeeksCount } = stats;
  const activities = entry.activities || [];
  const [year, month] = yearMonth.split("-").map(Number);
  const monthName = new Date(year, month - 1, 1).toLocaleString("default", { month: "long" });

  const card = document.createElement("div");
  card.className = "summary-card";

  const barsHTML = habitStats.map((h, i) => {
    const color = getActivityColor(i);
    const displayRate = h.monthRate;
    const barColor = displayRate >= 100 ? "var(--color-success, #22C55E)"
      : displayRate >= 70 ? "var(--color-warning, #F59E0B)"
      : "var(--color-danger, #EF4444)";
    const statusPill = h.extra > 0
      ? `<span class="summary-habit-streak">✅ Target met (+${h.extra} extra)</span>`
      : h.monthLogged >= h.monthTarget
        ? `<span class="summary-habit-streak">✅ Target met</span>`
        : `<span class="summary-habit-streak">${h.monthTarget - h.monthLogged} to go</span>`;
    const pctClass = `summary-habit-pct${h.extra > 0 ? " summary-habit-pct--over" : ""}`;
    const pctStyle = h.extra > 0 ? "" : `style="color:${barColor}"`;

    const paceBadgeClass = {
      ahead:      "pace-badge--ahead",
      "on-track": "pace-badge--on-track",
      behind:     "pace-badge--behind",
      early:      "pace-badge--early",
      started:    "pace-badge--started"
    }[h.paceKey] || "";

    return `
      <div class="summary-habit-row">
        <div class="summary-habit-top">
          <span class="summary-habit-name">
            <span class="summary-habit-dot" style="background:${color}"></span>
            ${h.name}
          </span>
          <div class="summary-habit-meta">
            ${statusPill}
            <span class="summary-habit-cad">${h.cadenceLabel}</span>
            <span class="${pctClass}" ${pctStyle}>${h.monthLogged}/${h.monthTarget}</span>
          </div>
        </div>
        <div class="summary-habit-track">
          <div class="summary-habit-fill" style="width:${displayRate}%;background:${barColor}"></div>
        </div>
        <div class="summary-habit-sub">
          <span class="pace-badge ${paceBadgeClass}">${h.paceLabel}</span>
          <span class="pace-message">${h.paceMessage}</span>
        </div>
      </div>`;
  }).join("");

  const calendarHTML = renderFullWeekCalendar(entry, habitStats, yearMonth, fullWeeksCount);

  card.innerHTML = `
    <div class="summary-card__header">
      <div>
        <div class="summary-card__title">My Progress</div>
        <div class="summary-card__sub">${activities.length} habit${activities.length !== 1 ? "s" : ""} · ${monthName} ${year}</div>
      </div>
      <button class="summary-share-btn" title="Share your stats">↗ Share</button>
    </div>
    <div class="summary-stats">
      <div class="summary-stat">
        <span class="summary-stat__icon">🎯</span>
        <div class="summary-stat__val">${monthlyTargetHitRate}<span class="summary-stat__unit">%</span></div>
        <div class="summary-stat__label">
          <span class="summary-stat__label-text">Targeted Habits Completed</span>
          <span class="summary-stat__help-wrap">
            <button class="summary-stat__help-btn" type="button" aria-label="About targeted habits completed" aria-expanded="false">i</button>
            <span class="summary-stat__tooltip" role="tooltip">
              <span>The percentage of your habits that have already reached their monthly target.</span>
            </span>
          </span>
        </div>
      </div>
      <div class="summary-stat">
        <span class="summary-stat__icon">✨</span>
        <div class="summary-stat__val">${perfectDays}/${totalThisMonth}</div>
        <div class="summary-stat__label">
          <span class="summary-stat__label-text">Perfect Days</span>
          <span class="summary-stat__help-wrap">
            <button class="summary-stat__help-btn" type="button" aria-label="About perfect days" aria-expanded="false">i</button>
            <span class="summary-stat__tooltip" role="tooltip">
              <span>Days you completed every habit.</span>
            </span>
          </span>
        </div>
      </div>
      <div class="summary-stat">
        <span class="summary-stat__icon">📅</span>
        <div class="summary-stat__val">${showUpDays}/${totalThisMonth}</div>
        <div class="summary-stat__label">
          <span class="summary-stat__label-text">Show-Up Days</span>
          <span class="summary-stat__help-wrap">
            <button class="summary-stat__help-btn" type="button" aria-label="About show-up days" aria-expanded="false">i</button>
            <span class="summary-stat__tooltip" role="tooltip">
              <span>Days you logged at least one habit.</span>
            </span>
          </span>
        </div>
      </div>
    </div>
    <div class="summary-note">
      Your monthly goals are based on how often per week you want to show up. You set the bar. Now go hit it.
    </div>
    <div class="summary-habits">
      <div class="summary-habits__label">This Month's Progress</div>
      <div class="summary-habits-grid">
        <div class="summary-habits-grid__left">
          ${barsHTML}
        </div>
        <div class="summary-habits-grid__right">
          ${calendarHTML}
        </div>
      </div>
    </div>
  `;

  card.querySelector(".summary-share-btn").addEventListener("click", () => {
    const text = `My showup. stats for ${monthName} ${year}:\n🎯 ${monthlyTargetHitRate}% targeted habits completed\n✨ ${perfectDays}/${totalThisMonth} perfect days\n📅 ${showUpDays}/${totalThisMonth} show-up days\n${habitStats.map(h => `• ${h.name}: ${h.monthLogged}/${h.monthTarget} this month${h.extra > 0 ? ` (+${h.extra} extra)` : ""}`).join("\n")}`;
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => showToast("Stats copied!", "info"));
    }
  });

  const statHelpWraps = Array.from(card.querySelectorAll(".summary-stat__help-wrap"));
  const closeStatTooltips = () => {
    statHelpWraps.forEach((wrap) => {
      wrap.classList.remove("is-open");
      const btn = wrap.querySelector(".summary-stat__help-btn");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  };

  card.querySelectorAll(".summary-stat__help-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const wrap = btn.closest(".summary-stat__help-wrap");
      if (!wrap) return;
      const willOpen = !wrap.classList.contains("is-open");
      closeStatTooltips();
      if (willOpen) {
        wrap.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });

  card.addEventListener("click", (e) => {
    if (!e.target.closest(".summary-stat__help-wrap")) closeStatTooltips();
  });

  card.querySelectorAll(".fw-day[data-overflow]").forEach(dayEl => {
    dayEl.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll(".fw-popover").forEach(p => p.remove());
      const allHabits = JSON.parse(dayEl.dataset.overflow);
      const pop = document.createElement("div");
      pop.className = "fw-popover";
      pop.innerHTML = allHabits.map(h =>
        `<span class="fw-popover-item"><i style="background:${h.color};width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:4px;flex-shrink:0;"></i>${h.name}</span>`
      ).join("");
      dayEl.appendChild(pop);
      setTimeout(() => {
        document.addEventListener("click", () => pop.remove(), { once: true });
      }, 0);
    });
  });

  return card;
}

function renderFullWeekCalendar(entry, habitStats, yearMonth, fullWeeksCount) {
  const [year, month] = yearMonth.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const daysInMonth = getDaysInMonth(yearMonth);
  const mondayOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month - 1, 1 - mondayOffset);
  const weekRows = [];

  for (let week = 0; week < 6; week++) {
    const row = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + week * 7 + d);
      row.push(date);
    }
    weekRows.push(row);
  }

  const marks = entry.marks || {};

  const fullWeekByStart = new Map();
  habitStats.forEach(h => {
    (h.fullWeeksBreakdown || []).forEach((w) => {
      if (!fullWeekByStart.has(w.label)) fullWeekByStart.set(w.label, []);
      fullWeekByStart.get(w.label).push({ name: h.name, logged: w.logged, target: w.target, hit: w.hit });
    });
  });

  const colorByName = {};
  habitStats.forEach((h, i) => { colorByName[h.name] = getActivityColor(i); });

  const MAX_DOTS = 5;

  let fullWeekOrdinal = 0;
  const weekBlocks = weekRows.map((row) => {
    const inMonth = row.filter(d => d.getMonth() === (month - 1));
    const isFullInMonthWeek = inMonth.length === 7;
    const weekLabel = isFullInMonthWeek ? `Wk${++fullWeekOrdinal}` : null;

    const badgeRows = (fullWeekByStart.get(weekLabel) || []).map(w => {
      const state = w.hit ? "hit" : (w.logged >= Math.max(1, w.target - 1) ? "close" : "miss");
      const color = colorByName[w.name] || "#888";
      return `<span class="fw-badge fw-badge--${state}"><i class="fw-badge-dot" style="background:${color}"></i>${w.name} ${w.logged}/${w.target}</span>`;
    }).join("");

    const dayCells = row.map(date => {
      const inCurrent = date.getMonth() === (month - 1);
      const dayNum = date.getDate();

      if (!inCurrent) {
        return `<div class="fw-day fw-day--muted"><span class="fw-day-num">${dayNum}</span></div>`;
      }

      const loggedHabits = habitStats
        .map((h, i) => ({ name: h.name, color: getActivityColor(i) }))
        .filter(h => (marks[h.name] || []).includes(dayNum));

      const visibleDots = loggedHabits.slice(0, MAX_DOTS);
      const hasOverflow = loggedHabits.length > MAX_DOTS;

      const dotsHTML = visibleDots.map(h =>
        `<i class="fw-habit-dot" style="background:${h.color}"></i>`
      ).join("") + (hasOverflow ? `<i class="fw-habit-dot fw-habit-dot--more">+${loggedHabits.length - MAX_DOTS}</i>` : "");

      const overflowAttr = hasOverflow
        ? ` data-overflow='${JSON.stringify(loggedHabits).replace(/'/g, "&#39;")}'`
        : "";

      return `<div class="fw-day${hasOverflow ? " fw-day--has-overflow" : ""}"${overflowAttr}><span class="fw-day-num">${dayNum}</span>${dotsHTML ? `<div class="fw-day-dots">${dotsHTML}</div>` : ""}</div>`;
    }).join("");

    if (isFullInMonthWeek) {
      return `<div class="fw-week fw-week--full"><div class="fw-week-grid">${dayCells}</div><div class="fw-badges">${badgeRows}</div></div>`;
    }
    return `<div class="fw-week"><div class="fw-week-grid">${dayCells}</div></div>`;
  }).join("");

  const legendHTML = `
    <div class="fw-legend">
      <span class="fw-legend-pill fw-badge fw-badge--hit">Target hit</span>
      <span class="fw-legend-pill fw-badge fw-badge--close">Close</span>
      <span class="fw-legend-pill fw-badge fw-badge--miss">Missed</span>
    </div>`;

  return `
    <div class="fullweek-calendar">
      <div class="fullweek-calendar__title">${monthName(yearMonth)}</div>
      <div class="fullweek-calendar__sub">Full-week cadence view (Monday to Sunday)</div>
      <div class="fw-dow"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
      ${weekBlocks}
      ${legendHTML}
    </div>`;
}

function monthName(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ─── LOAD ALL LOGS ────────────────────────────────────────
export function loadAllLogs(yearMonth, container, currentUser) {
  showLoader();
  container.innerHTML = "";

  const entriesRef = collection(db, "logs", yearMonth, "entries");

  return onSnapshot(entriesRef, async (snapshot) => {
    const validDocs = snapshot.docs.filter(docSnap => {
      if (docSnap.id === currentUser?.uid) return false;
      const data = docSnap.data();
      return data.activities && data.activities.length > 0;
    });

    if (validDocs.length === 0) {
      hideLoader();
      container.innerHTML = `<p class="empty-state">No other trackers yet for this month.</p>`;
      return;
    }

    const needsUserFetch = validDocs.map(d => !d.data().displayName);
    const [userSnaps, myUserSnap] = await Promise.all([
      Promise.all(
        validDocs.map((docSnap, i) =>
          needsUserFetch[i]
            ? getDoc(doc(db, "users", docSnap.id))
            : Promise.resolve(null)
        )
      ),
      currentUser?.uid
        ? getDoc(doc(db, "users", currentUser.uid))
        : Promise.resolve(null)
    ]);

    const myFollows = new Set(
      myUserSnap?.exists() ? (myUserSnap.data().following || []) : []
    );

    const entries = validDocs
      .map((docSnap, i) => {
        const data = docSnap.data();
        let displayName = data.displayName;
        let username    = data.username;
        if (needsUserFetch[i]) {
          const userSnap = userSnaps[i];
          if (!userSnap?.exists()) return null;
          const userData = userSnap.data();
          displayName = userData.displayName;
          username    = userData.username || userData.displayName;
        }
        return { id: docSnap.id, ...data, displayName, username: username || displayName };
      })
      .filter(Boolean);

    entries.sort((a, b) => {
      const aF = myFollows.has(a.id), bF = myFollows.has(b.id);
      if (aF && !bF) return -1;
      if (!aF && bF) return 1;
      return (a.displayName || "").localeCompare(b.displayName || "");
    });

    container.innerHTML = "";
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
  let userCache = {};
  let logsCache = {};
  let pinnedFollowingIds = [];
  const myRef = doc(db, "users", currentUser.uid);

  const unsubMe = onSnapshot(myRef, async (mySnap) => {
    if (!mySnap.exists()) { renderFollowingEmpty(container, onSwitchToAll); hideLoader(); return; }

    const followingIds = mySnap.data().following || [];
    const pinnedIds = mySnap.data().pinnedFollowing || [];
    pinnedFollowingIds = pinnedIds.filter(uid => followingIds.includes(uid));
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
        delete logsCache[uid];
        delete userCache[uid];
      }
    }

    for (const uid of newIds) {
      if (oldIds.has(uid)) continue;
      let userData;
      try {
        const userSnap = await getDoc(doc(db, "users", uid));
        if (!userSnap.exists()) continue;
        userData = userSnap.data();
        userCache[uid] = userData;
      } catch (e) { continue; }

      const logRef = doc(db, "logs", yearMonth, "entries", uid);
      const unsubLog = onSnapshot(logRef, (logSnap) => {
        if (!logSnap.exists() || !logSnap.data().activities?.length) logsCache[uid] = null;
        else logsCache[uid] = { id: uid, ...logSnap.data(), displayName: userData.displayName };
        renderFollowingBoard(container, {
          currentUser,
          yearMonth,
          followingIds,
          pinnedFollowingIds,
          logsCache,
          userCache,
          onSwitchToAll
        });
        hideLoader();
      }, (err) => { console.error("Log snapshot error:", err); hideLoader(); });

      logUnsubMap[uid] = unsubLog;
    }

    renderFollowingBoard(container, {
      currentUser,
      yearMonth,
      followingIds,
      pinnedFollowingIds,
      logsCache,
      userCache,
      onSwitchToAll
    });
    hideLoader();

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

function renderFollowingBoard(container, model) {
  const {
    currentUser, yearMonth, followingIds, pinnedFollowingIds,
    logsCache, userCache, onSwitchToAll
  } = model;
  container.innerHTML = "";

  const pinnedSet = new Set(pinnedFollowingIds);
  const items = followingIds.map(uid => ({
    uid,
    user: userCache[uid] || null,
    log: Object.prototype.hasOwnProperty.call(logsCache, uid) ? logsCache[uid] : undefined,
    isPinned: pinnedSet.has(uid)
  }));

  const pinnedActive = items.filter(i => i.log && i.isPinned);
  const activeUnpinned = items.filter(i => i.log && !i.isPinned);
  const noTracker = items.filter(i => i.log === null);

  const board = document.createElement("div");
  board.className = "following-board";

  if (pinnedActive.length > 0) {
    board.classList.add("has-pinned");

    const pinnedCol = renderFollowingSection(
      `Pinned + active this month (${pinnedActive.length})`,
      "calendar",
      pinnedActive,
      { currentUser, yearMonth }
    );
    pinnedCol.classList.add("following-main-col");

    const sideCol = document.createElement("div");
    sideCol.className = "following-side-col";
    sideCol.appendChild(renderFollowingSection(
      `Following + Active (Not Pinned) (${activeUnpinned.length})`,
      "compact",
      activeUnpinned,
      { currentUser, yearMonth }
    ));
    sideCol.appendChild(renderFollowingSection(
      `Following + No Tracker This Month (${noTracker.length})`,
      "compact",
      noTracker,
      { currentUser, yearMonth }
    ));
    sideCol.appendChild(renderBrowseNudge(onSwitchToAll, { asSection: true }));

    board.appendChild(pinnedCol);
    board.appendChild(sideCol);
  } else {
    board.classList.add("no-pinned");
    const cards = document.createElement("div");
    cards.className = "following-no-pinned-grid";
    cards.appendChild(renderFollowingSection(
      `Following + Active (${activeUnpinned.length})`,
      "compact",
      activeUnpinned,
      { currentUser, yearMonth }
    ));
    cards.appendChild(renderFollowingSection(
      `No Tracker This Month (${noTracker.length})`,
      "compact",
      noTracker,
      { currentUser, yearMonth }
    ));
    cards.appendChild(renderBrowseNudge(onSwitchToAll, { asSection: true }));
    board.appendChild(cards);
  }

  container.appendChild(board);
}

function renderFollowingSection(title, type, items, ctx) {
  const section = document.createElement("section");
  section.className = "following-section";

  const header = document.createElement("div");
  header.className = "following-section-header";
  header.innerHTML = `<h3>${title}</h3>`;
  section.appendChild(header);

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "following-section-empty";
    empty.textContent = "No users in this section yet.";
    section.appendChild(empty);
    return section;
  }

  if (type === "calendar") {
    const grid = document.createElement("div");
    grid.className = "following-calendar-grid";
    items.forEach(item => {
      const slot = document.createElement("div");
      slot.className = "following-card-slot";
      slot.appendChild(renderPinControl(item, ctx.currentUser));
      slot.appendChild(renderMobileCard(item.log, ctx.yearMonth, ctx.currentUser, { isFollowing: true, showFollowBtn: true }));
      grid.appendChild(slot);
    });
    section.appendChild(grid);
    return section;
  }

  const list = document.createElement("div");
  list.className = "following-compact-list";
  items.forEach(item => {
    list.appendChild(renderCompactRow(item, ctx.currentUser));
  });
  section.appendChild(list);
  return section;
}

function renderPinControl(item, currentUser) {
  const wrap = document.createElement("div");
  wrap.className = "following-pin-wrap";
  const btn = document.createElement("button");
  btn.className = `following-pin-btn ${item.isPinned ? "active" : ""}`;
  btn.textContent = item.isPinned ? "★ Pinned" : "☆ Pin";
  btn.addEventListener("click", async () => {
    await togglePinned(currentUser.uid, item.uid, !item.isPinned);
  });
  wrap.appendChild(btn);
  return wrap;
}

function renderCompactRow(item, currentUser) {
  const row = document.createElement("div");
  row.className = "following-compact-row";
  const displayName = item.user?.displayName || "Unknown user";
  const initials = displayName.charAt(0).toUpperCase();
  const avatarUrl = item.user?.decoration?.avatarUrl;
  const hasTracker = !!item.log;
  const statText = hasTracker
    ? `${countMarkedDays(item.log)} check-ins this month`
    : "No tracker set up for this month";

  row.innerHTML = `
    <div class="following-compact-user">
      <div class="following-compact-avatar-wrap">
        ${avatarUrl
          ? `<img src="${avatarUrl}" class="following-compact-avatar" alt="avatar" />`
          : `<div class="following-compact-avatar-initials">${initials}</div>`
        }
      </div>
      <div class="following-compact-copy">
        <div class="following-compact-name">${displayName}</div>
        <div class="following-compact-meta">${statText}</div>
      </div>
    </div>
    <div class="following-compact-actions">
      <span class="following-status-chip ${hasTracker ? "has-tracker" : "no-tracker"}">
        ${hasTracker ? "Has tracker" : "No tracker"}
      </span>
    </div>
  `;

  const actions = row.querySelector(".following-compact-actions");
  const pinBtn = document.createElement("button");
  pinBtn.className = `following-pin-btn following-pin-btn-small ${item.isPinned ? "active" : ""}`;
  pinBtn.textContent = item.isPinned ? "Pinned" : "Pin";
  pinBtn.addEventListener("click", async () => {
    await togglePinned(currentUser.uid, item.uid, !item.isPinned);
  });
  actions.appendChild(pinBtn);

  return row;
}

function renderBrowseNudge(onSwitchToAll, opts = {}) {
  const { asSection = false } = opts;
  const slot = document.createElement("div");
  slot.className = asSection ? "following-section following-nudge-section" : "following-nudge-slot";
  slot.innerHTML = `
    <div class="following-nudge-card">
      <div class="following-nudge-icon">👥</div>
      <p class="following-nudge-title">Follow more people</p>
      <p class="following-nudge-sub">Visit the All tab to discover and follow other trackers</p>
      <button class="following-browse-btn" id="nudge-browse-btn">Browse All →</button>
    </div>`;
  slot.querySelector("#nudge-browse-btn")?.addEventListener("click", onSwitchToAll);
  return slot;
}

function countMarkedDays(entry) {
  if (!entry?.marks) return 0;
  return Object.values(entry.marks).reduce((sum, days) => sum + (Array.isArray(days) ? days.length : 0), 0);
}

async function togglePinned(currentUid, targetUid, shouldPin) {
  try {
    const userRef = doc(db, "users", currentUid);
    await setDoc(userRef, {
      pinnedFollowing: shouldPin ? arrayUnion(targetUid) : arrayRemove(targetUid)
    }, { merge: true });
  } catch (error) {
    console.error("Pin update error:", error);
    showToast("Couldn't update pin. Try again.", "error");
  }
}

// ─── RENDER ONE USER SECTION (desktop My Log) ─────────────
function renderUserSection(entry, yearMonth, currentUser, isCurrentMonth, todayDate, onMarkToggled) {
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
      isCurrentMonth, todayDate, cad,
      entry, onMarkToggled
    );
    section.appendChild(row);
  });

  return section;
  //Migoy taba!
}

// ─── RENDER ONE ACTIVITY ROW (desktop) ────────────────────
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
        toggleDay(cell, d, activity, markedDays, activityColor, marker, yearMonth, userId, entry, onMarkToggled)
      );
    }
    row.appendChild(cell);
  }
  return row;
}

// ─── TOGGLE A DAY (desktop) ───────────────────────────────
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
    cell.textContent       = MARKER_SYMBOLS[marker] || "●";
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
