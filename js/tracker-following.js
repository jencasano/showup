import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, onSnapshot, arrayUnion, arrayRemove,
  collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast, showLoader, hideLoader } from "./ui.js";
import { renderPeopleView } from "./following-people.js";
import { renderFeedView } from "./following-feed.js";

let currentView = "people";

async function fetchLatestDiaryEntry(uid) {
  const snap = await getDocs(collection(db, "diary", uid, "entries"));
  if (snap.empty) return null;
  const sorted = snap.docs
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.id))
    .sort((a, b) => b.id.localeCompare(a.id));
  for (const d of sorted) {
    const data = d.data();
    if (data.note || data.photoUrl) return { docId: d.id, ...data };
  }
  return null;
}

async function fetchTodayDiaryEntry(uid) {
  const today = new Date().toISOString().slice(0, 10);
  console.log("Fetching diary for", uid, "at path diary/", uid, "/entries/", today);
  const snap = await getDoc(doc(db, "diary", uid, "entries", today));
  console.log("Diary snap exists:", snap.exists(), "data:", snap.data());
  if (!snap.exists()) { console.log("Returning null for", uid); return null; }
  const data = snap.data();
  if (!data.note && !data.photoUrl) { console.log("Returning null for", uid); return null; }
  return { docId: today, ...data };
}

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

  let logUnsubMap   = {};
  let diaryUnsubMap = {};
  let userCache   = {};
  let logsCache   = {};
  let diaryCache  = {};
  let followingIds       = [];
  let pinnedFollowingIds = [];
  let diaryReady = false; // gate: don't renderBoard until diary fetch is done

  function renderBoard() {
    if (!diaryReady) return; // diary cache not ready yet -- skip

    container.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "fw-centered-wrap";
    container.appendChild(wrap);

    const header = document.createElement("div");
    header.className = "fw-header";
    const titleRow = document.createElement("div");
    titleRow.className = "fw-title-row";
    const title = document.createElement("h2");
    title.className = "fw-title";
    title.textContent = "Following";
    const count = document.createElement("span");
    count.className = "fw-count";
    const loadedCount = followingIds.filter(uid => userCache[uid]).length;
    count.textContent = `${loadedCount} ${loadedCount === 1 ? "person" : "people"}`;
    const toggle = document.createElement("div");
    toggle.className = "fw-view-toggle";
    const pillPeople = document.createElement("button");
    pillPeople.className = `fw-vt-pill${currentView === "people" ? " active" : ""}`;
    pillPeople.textContent = "People";
    pillPeople.addEventListener("click", () => { currentView = "people"; renderBoard(); });
    const pillFeed = document.createElement("button");
    pillFeed.className = `fw-vt-pill${currentView === "feed" ? " active" : ""}`;
    pillFeed.textContent = "Feed";
    pillFeed.addEventListener("click", () => { currentView = "feed"; renderBoard(); });
    toggle.append(pillPeople, pillFeed);
    titleRow.append(title, count, toggle);
    header.appendChild(titleRow);
    const divider = document.createElement("hr");
    divider.className = "fw-divider";
    wrap.append(header, divider);

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

    const boardContainer = document.createElement("div");
    boardContainer.className = "fw-board";
    wrap.appendChild(boardContainer);

    if (currentView === "feed") {
      renderFeedView(boardContainer, {
        currentUser,
        yearMonth,
        followingIds,
        pinnedFollowingIds,
        logsCache,
        userCache,
        diaryCache,
        onSwitchToAll,
      });
    } else {
      renderPeopleView(boardContainer, {
        currentUser,
        yearMonth,
        followingIds,
        pinnedFollowingIds,
        logsCache,
        userCache,
        diaryCache,
        onSwitchToAll,
      });
    }
  }

  const myRef = doc(db, "users", currentUser.uid);

  const unsubMe = onSnapshot(myRef, async (mySnap) => {
    diaryReady = false; // reset gate while we re-fetch

    if (!mySnap.exists()) {
      followingIds = [];
      pinnedFollowingIds = [];
      diaryReady = true;
      renderBoard();
      hideLoader();
      return;
    }

    const data = mySnap.data();
    followingIds       = data.following        || [];
    pinnedFollowingIds = (data.pinnedFollowing || []).filter(uid => followingIds.includes(uid));

    const statEl = document.getElementById("month-bar-stat");
    if (statEl) {
      statEl.textContent = followingIds.length > 0
        ? `Following ${followingIds.length} ${followingIds.length === 1 ? "person" : "people"} this month`
        : "";
    }

    // Fetch user docs for new followingIds
    const deletedUids = new Set();
    await Promise.all(followingIds.map(async (uid) => {
      if (userCache[uid]) return;
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) userCache[uid] = snap.data();
        else deletedUids.add(uid);
      } catch { /* network error -- leave unresolved, don't assume deleted */ }
    }));

    // Auto-clean confirmed-deleted follows
    if (deletedUids.size > 0) {
      const staleUids = [...deletedUids];
      followingIds = followingIds.filter(uid => !deletedUids.has(uid));
      pinnedFollowingIds = pinnedFollowingIds.filter(uid => !deletedUids.has(uid));
      setDoc(myRef, {
        following: arrayRemove(...staleUids),
        pinnedFollowing: arrayRemove(...staleUids),
      }, { merge: true }).catch(() => {});
    }

    // Subscribe to diary entries for rolling window (up to 3 days, capped to current month)
    const now = new Date();
    const [ym_y, ym_m] = yearMonth.split("-").map(Number);
    const windowDates = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      if (d.getFullYear() === ym_y && d.getMonth() + 1 === ym_m) {
        const ds = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        windowDates.push(ds);
      }
    }

    for (const uid of followingIds) {
      if (!diaryCache[uid]) diaryCache[uid] = {};
      for (const dateStr of windowDates) {
        const key = `${uid}-${dateStr}`;
        if (diaryUnsubMap[key]) continue;
        const diaryRef = doc(db, "diary", uid, "entries", dateStr);
        diaryUnsubMap[key] = onSnapshot(diaryRef, (snap) => {
          if (!diaryCache[uid]) diaryCache[uid] = {};
          if (snap.exists() && snap.data().note) {
            diaryCache[uid][dateStr] = { docId: dateStr, ...snap.data() };
          } else {
            diaryCache[uid][dateStr] = null;
          }
          renderBoard();
        }, (err) => {
          console.error("Diary snapshot error:", err);
          if (!diaryCache[uid]) diaryCache[uid] = {};
          diaryCache[uid][dateStr] = null;
        });
      }
    }

    // Remove listeners for uids no longer followed
    const newSet = new Set(followingIds);
    for (const uid of Object.keys(logUnsubMap)) {
      if (!newSet.has(uid)) {
        logUnsubMap[uid]();
        delete logUnsubMap[uid];
        for (const key of Object.keys(diaryUnsubMap)) {
          if (key.startsWith(uid + "-")) { diaryUnsubMap[key](); delete diaryUnsubMap[key]; }
        }
        delete logsCache[uid];
        delete userCache[uid];
        delete diaryCache[uid];
      }
    }

    // Subscribe to log docs for new followingIds
    for (const uid of followingIds) {
      if (logUnsubMap[uid]) continue;
      const logRef = doc(db, "logs", yearMonth, "entries", uid);
      logUnsubMap[uid] = onSnapshot(logRef, (logSnap) => {
        const d = logSnap.data();
        logsCache[uid] = logSnap.exists() && d?.activities?.length
          ? { id: uid, ...d, displayName: userCache[uid]?.displayName || "" }
          : null;
        renderBoard(); // safe -- diaryReady gates this
      }, (err) => {
        console.error("Log snapshot error:", err);
      });
    }

    // All data ready -- open the gate and render
    diaryReady = true;
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
    Object.values(diaryUnsubMap).forEach(u => u());
    logUnsubMap = {};
    diaryUnsubMap = {};
  };
}
