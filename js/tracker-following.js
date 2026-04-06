import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, onSnapshot, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast, showLoader, hideLoader } from "./ui.js";
import { renderMobileCard } from "./mobile-tracker.js";

export function loadFollowingLogs(yearMonth, container, currentUser, onSwitchToAll, silent = false) {
  if (!silent) showLoader();
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
      <lottie-player src="https://assets10.lottiefiles.com/packages/lf20_jtbfg2nb.json" background="transparent" speed="1" class="following-lottie-icon" loop autoplay></lottie-player>
      <h3 class="following-empty-title">See who shows up</h3>
      <p class="following-empty-sub">Head to the All tab to find people who show up \u2192</p>
      <button class="following-browse-btn" id="browse-all-btn">Browse All \u2192</button>
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
      `\ud83d\udccc Always Here (${pinnedActive.length})`,
      "calendar",
      pinnedActive,
      { currentUser, yearMonth }
    );
    pinnedCol.classList.add("following-main-col");

    const sideCol = document.createElement("div");
    sideCol.className = "following-side-col";
    sideCol.appendChild(renderFollowingSection(
      `Showing Up (${activeUnpinned.length})`,
      "compact",
      activeUnpinned,
      { currentUser, yearMonth }
    ));
    sideCol.appendChild(renderFollowingSection(
      `Crickets... \ud83e\udd97 (${noTracker.length})`,
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
      `Showing Up (${activeUnpinned.length})`,
      "compact",
      activeUnpinned,
      { currentUser, yearMonth }
    ));
    cards.appendChild(renderFollowingSection(
      `Crickets... \ud83e\udd97 (${noTracker.length})`,
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
      slot.appendChild(renderMobileCard(item.log, ctx.yearMonth, ctx.currentUser, { isFollowing: true, showFollowBtn: true }));
      slot.appendChild(renderPinControl(item, ctx.currentUser));
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
  btn.textContent = "\ud83d\udccc";
  btn.title = item.isPinned ? "Unpin" : "Pin to front row";
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
  pinBtn.textContent = "\ud83d\udccc";
  pinBtn.title = item.isPinned ? "Unpin" : "Pin to front row";
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
      <lottie-player src="https://assets10.lottiefiles.com/packages/lf20_jtbfg2nb.json" background="transparent" speed="1" class="following-lottie-icon" loop autoplay></lottie-player>
      <p class="following-nudge-title">See who shows up</p>
      <p class="following-nudge-sub">Head to the All tab to find people who show up \u2192</p>
      <button class="following-browse-btn" id="nudge-browse-btn">Browse All \u2192</button>
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
