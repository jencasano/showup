import { db, auth } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, onSnapshot, arrayUnion, arrayRemove,
  collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast, showLoader, hideLoader } from "./ui.js";
import { renderPeopleView } from "./following-people.js";
import { renderFeedView } from "./following-feed.js";
import { createDebouncer } from "./feed-debounce.js";
import { buildLogEvent, buildDiaryEvent } from "./feed-event.js";

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
  let feedEvents = [];    // rendered events
  let pendingEvents = []; // queued events (shown via "New posts" pill)

  function isFeedScrolledDown() {
    const stream = boardEl?.querySelector(".fw-feed-stream");
    if (!stream) return false;
    return stream.getBoundingClientRect().top < -50;
  }

  function flushPending() {
    for (const evt of pendingEvents) {
      const idx = feedEvents.findIndex(e => e.key === evt.key);
      if (idx >= 0) feedEvents[idx] = evt;
      else feedEvents.push(evt);
    }
    pendingEvents = [];
    renderBoard();
    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onFeedEvent(type, uid, dateStr) {
    const user = userCache[uid] || null;
    let evt;
    if (type === "log") {
      const log = logsCache[uid];
      if (!log) return;
      const evtDate = dateStr || new Date().toISOString().slice(0, 10);
      evt = buildLogEvent(uid, user, log, yearMonth, evtDate);
    } else {
      const diaryEntry = diaryCache[uid]?.[dateStr] || null;
      if (!diaryEntry) return;
      evt = buildDiaryEvent(uid, user, diaryEntry, dateStr);
    }

    if (currentView === "feed" && isFeedScrolledDown()) {
      // User is reading -- queue silently
      const idx = pendingEvents.findIndex(e => e.key === evt.key);
      if (idx >= 0) pendingEvents[idx] = evt;
      else pendingEvents.push(evt);
    } else {
      // User is at top or not on feed -- merge directly
      const idx = feedEvents.findIndex(e => e.key === evt.key);
      if (idx >= 0) feedEvents[idx] = evt;
      else feedEvents.push(evt);
    }
    renderBoard();
  }

  // Auto-flush pending events when user scrolls back to top
  let scrollTicking = false;
  function onScrollCheck() {
    if (!scrollTicking) {
      requestAnimationFrame(() => {
        if (pendingEvents.length > 0 && currentView === "feed" && !isFeedScrolledDown()) {
          flushPending();
        }
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  }
  window.addEventListener("scroll", onScrollCheck, { passive: true });

  const debouncer = createDebouncer(onFeedEvent);
  const firstLogSnapshot = new Set(); // bypass debounce on first snapshot per uid

  // Persistent header refs (built once, updated incrementally)
  let boardRoot = null;
  let countEl = null;
  let boardEl = null;
  let pillPeopleEl = null;
  let pillFeedEl = null;
  let lastView = null;

  function initBoard() {
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
    countEl = document.createElement("span");
    countEl.className = "fw-count";
    const toggle = document.createElement("div");
    toggle.className = "fw-view-toggle";
    pillPeopleEl = document.createElement("button");
    pillPeopleEl.className = "fw-vt-pill";
    pillPeopleEl.textContent = "People";
    pillPeopleEl.addEventListener("click", () => { currentView = "people"; renderBoard(); });
    pillFeedEl = document.createElement("button");
    pillFeedEl.className = "fw-vt-pill";
    pillFeedEl.textContent = "Feed";
    pillFeedEl.addEventListener("click", () => { currentView = "feed"; renderBoard(); });
    toggle.append(pillPeopleEl, pillFeedEl);
    titleRow.append(title, countEl, toggle);
    header.appendChild(titleRow);
    const divider = document.createElement("hr");
    divider.className = "fw-divider";
    wrap.append(header, divider);

    boardEl = document.createElement("div");
    boardEl.className = "fw-board";
    wrap.appendChild(boardEl);

    boardRoot = wrap;
    lastView = null;
  }

  function renderBoard() {
    if (!diaryReady) return;
    // Build header once (or if DOM was destroyed externally, e.g. tab switch)
    if (!boardRoot || !container.contains(boardRoot)) {
      initBoard();
    }

    // Update count
    const loadedCount = followingIds.filter(uid => userCache[uid]).length;
    countEl.textContent = `${loadedCount} ${loadedCount === 1 ? "person" : "people"}`;

    // Update pill states
    pillPeopleEl.classList.toggle("active", currentView === "people");
    pillFeedEl.classList.toggle("active", currentView === "feed");

    // Empty state
    if (followingIds.length === 0) {
      boardEl.innerHTML = "";
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
      boardEl.appendChild(empty);
      lastView = null;
      return;
    }

    // Clear board on view switch
    if (lastView !== null && lastView !== currentView) {
      boardEl.innerHTML = "";
    }
    lastView = currentView;

    const model = {
      currentUser, yearMonth, followingIds, pinnedFollowingIds,
      logsCache, userCache, diaryCache, onSwitchToAll,
      feedEvents, pendingEvents, flushPending,
    };

    if (currentView === "feed") {
      renderFeedView(boardEl, model);
    } else {
      boardEl.innerHTML = "";
      renderPeopleView(boardEl, model);
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

    // Fetch most recent diary entry for each followed user this month
    await Promise.all(followingIds.map(async (uid) => {
      if (!diaryCache[uid]) diaryCache[uid] = {};
      try {
        const entriesRef = collection(db, "diary", uid, "entries");
        const snap = await getDocs(entriesRef);
        const matching = snap.docs
          .filter(d => d.id.startsWith(yearMonth) && (d.data().note || d.data().photoUrl))
          .sort((a, b) => b.id.localeCompare(a.id));
        if (matching.length > 0) {
          const d = matching[0];
          diaryCache[uid][d.id] = { docId: d.id, ...d.data() };
        }
      } catch { /* best-effort */ }
    }));

    // Real-time listeners for rolling window (last 3 days) to catch live updates
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
      for (const dateStr of windowDates) {
        const key = `${uid}-${dateStr}`;
        if (diaryUnsubMap[key]) continue;
        const diaryRef = doc(db, "diary", uid, "entries", dateStr);
        diaryUnsubMap[key] = onSnapshot(diaryRef, (snap) => {
          if (!diaryCache[uid]) diaryCache[uid] = {};
          if (snap.exists() && (snap.data().note || snap.data().photoUrl)) {
            diaryCache[uid][dateStr] = { docId: dateStr, ...snap.data() };
            debouncer.diaryChanged(uid, dateStr);
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
        if (!firstLogSnapshot.has(uid)) {
          firstLogSnapshot.add(uid);
          onFeedEvent("log", uid);    // immediate on first load
        } else {
          debouncer.logChanged(uid);  // debounced on real-time updates
        }
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
    hideLoader();
    // Logout race: the listener is still live when auth flips to null,
    // which surfaces as permission-denied. Swallow silently.
    if (!auth.currentUser) return;
    showToast("couldn't load following. try again?", "error");
  });

  return () => {
    unsubMe();
    debouncer.destroy();
    window.removeEventListener("scroll", onScrollCheck);
    Object.values(logUnsubMap).forEach(u => u());
    Object.values(diaryUnsubMap).forEach(u => u());
    logUnsubMap = {};
    diaryUnsubMap = {};
  };
}
