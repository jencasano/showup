import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, onSnapshot, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast, showLoader, hideLoader } from "./ui.js";
import { renderPeopleView } from "./following-people.js";
import { renderFeedView } from "./following-feed.js";

let currentView = "people";

export function loadFollowingLogs(yearMonth, container, currentUser, onSwitchToAll, silent = false) {
  if (!silent) showLoader();
  container.innerHTML = "";

  if (!currentUser?.uid) {
    hideLoader();
    const msg = document.createElement("p");
    msg.className = "empty-state";
    msg.textContent = "Not logged in.";
    container.appendChild(msg);
    return () => {};
  }

  let logUnsubMap = {};
  let userCache   = {};
  let logsCache   = {};
  let followingIds       = [];
  let pinnedFollowingIds = [];

  function renderBoard() {
    container.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "fw-centered-wrap";
    container.appendChild(wrap);

    // ── Header ──────────────────────────────────────────
    const header = document.createElement("div");
    header.className = "fw-header";

    const titleRow = document.createElement("div");
    titleRow.className = "fw-title-row";

    const title = document.createElement("h2");
    title.className = "fw-title";
    title.textContent = "Following";

    const count = document.createElement("span");
    count.className = "fw-count";
    count.textContent = `${followingIds.length} ${followingIds.length === 1 ? "person" : "people"}`;

    const toggle = document.createElement("div");
    toggle.className = "fw-view-toggle";

    const pillPeople = document.createElement("button");
    pillPeople.className = `fw-vt-pill${currentView === "people" ? " active" : ""}`;
    pillPeople.textContent = "People";
    pillPeople.addEventListener("click", () => {
      currentView = "people";
      renderBoard();
    });

    const pillFeed = document.createElement("button");
    pillFeed.className = `fw-vt-pill${currentView === "feed" ? " active" : ""}`;
    pillFeed.textContent = "Feed";
    pillFeed.addEventListener("click", () => {
      currentView = "feed";
      renderBoard();
    });

    toggle.append(pillPeople, pillFeed);
    titleRow.append(title, count, toggle);
    header.appendChild(titleRow);

    const divider = document.createElement("hr");
    divider.className = "fw-divider";

    wrap.append(header, divider);

    // ── Empty state ──────────────────────────────────────
    if (followingIds.length === 0) {
      const empty = document.createElement("div");
      empty.className = "following-empty";
      empty.innerHTML = `
        <lottie-player src="https://assets10.lottiefiles.com/packages/lf20_jtbfg2nb.json"
          background="transparent" speed="1" class="following-lottie-icon" loop autoplay>
        </lottie-player>
        <h3 class="following-empty-title">See who shows up</h3>
        <p class="following-empty-sub">Head to the All tab to find people who show up \u2192</p>`;
      const browseBtn = document.createElement("button");
      browseBtn.className = "following-browse-btn";
      browseBtn.textContent = "Browse All \u2192";
      browseBtn.addEventListener("click", onSwitchToAll);
      empty.appendChild(browseBtn);
      wrap.appendChild(empty);
      return;
    }

    // ── Board ────────────────────────────────────────────
    const boardContainer = document.createElement("div");
    boardContainer.className = "fw-board";
    wrap.appendChild(boardContainer);

    if (currentView === "feed") {
      renderFeedView(boardContainer);
    } else {
      renderPeopleView(boardContainer, {
        currentUser,
        yearMonth,
        followingIds,
        pinnedFollowingIds,
        logsCache,
        userCache,
        onSwitchToAll,
      });
    }
  }

  const myRef = doc(db, "users", currentUser.uid);

  const unsubMe = onSnapshot(myRef, async (mySnap) => {
    if (!mySnap.exists()) {
      followingIds       = [];
      pinnedFollowingIds = [];
      renderBoard();
      hideLoader();
      return;
    }

    const data   = mySnap.data();
    followingIds       = data.following        || [];
    pinnedFollowingIds = (data.pinnedFollowing || []).filter(uid => followingIds.includes(uid));

    // Update month-bar-stat
    const statEl = document.getElementById("month-bar-stat");
    if (statEl) {
      statEl.textContent = followingIds.length > 0
        ? `Following ${followingIds.length} ${followingIds.length === 1 ? "person" : "people"} this month`
        : "";
    }

    // Fetch user docs for any new followingIds
    await Promise.all(followingIds.map(async (uid) => {
      if (userCache[uid]) return;
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) userCache[uid] = snap.data();
      } catch { /* skip */ }
    }));

    // Remove listeners for uids no longer followed
    const newSet = new Set(followingIds);
    for (const uid of Object.keys(logUnsubMap)) {
      if (!newSet.has(uid)) {
        logUnsubMap[uid]();
        delete logUnsubMap[uid];
        delete logsCache[uid];
        delete userCache[uid];
      }
    }

    // Subscribe to log docs for any new followingIds
    for (const uid of followingIds) {
      if (logUnsubMap[uid]) continue;
      const logRef = doc(db, "logs", yearMonth, "entries", uid);
      logUnsubMap[uid] = onSnapshot(logRef, (logSnap) => {
        const data = logSnap.data();
        logsCache[uid] = logSnap.exists() && data?.activities?.length
          ? { id: uid, ...data, displayName: userCache[uid]?.displayName || "" }
          : null;
        renderBoard();
      }, (err) => {
        console.error("Log snapshot error:", err);
      });
    }

    renderBoard();
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
