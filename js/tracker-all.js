import { db } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast, showLoader, hideLoader } from "./ui.js";
import { renderMobileCard } from "./cal-card.js";
import { renderLockedCard, renderLowKeyCard, renderGhostCard } from "./tracker-all-cards.js";
import { renderDiaryStrip } from "./diary-strip.js";
import { computeSignal } from "./following-signals.js";

export function loadAllLogs(yearMonth, container, currentUser, silent = false) {
  if (!silent) showLoader();
  container.innerHTML = "";

  const entriesRef = collection(db, "logs", yearMonth, "entries");
  let searchQuery = "";
  let latestEntries = [];
  let latestFollows = new Set();
  let controlsMounted = false;
  let wrapperEl = null;
  let statLineEl = null;
  let gridEl = null;

  function normalizeText(value) {
    return String(value || "").toLowerCase().trim();
  }

  function tokenizeQuery(query) {
    return normalizeText(query).split(/\s+/).filter(Boolean);
  }

  function scoreEntry(entry, query) {
    const queryNorm = normalizeText(query);
    if (!queryNorm) return 0;

    const tokens = tokenizeQuery(queryNorm);
    if (tokens.length === 0) return 0;

    const name = normalizeText(entry.displayName);
    const username = normalizeText(entry.username);
    const activities = entry._searchActivities || [];

    let score = 0;
    let matchedTokens = 0;

    if (name === queryNorm) score += 140;
    else if (name.startsWith(queryNorm)) score += 120;
    else if (name.includes(queryNorm)) score += 90;

    for (const token of tokens) {
      let tokenMatched = false;

      if (name.startsWith(token)) {
        score += 100;
        tokenMatched = true;
      } else if (name.includes(token)) {
        score += 70;
        tokenMatched = true;
      }

      if (username === token) {
        score += 70;
        tokenMatched = true;
      } else if (username.includes(token)) {
        score += 45;
        tokenMatched = true;
      }

      const exactActivity = activities.some(a => a === token);
      if (exactActivity) {
        score += 60;
        tokenMatched = true;
      } else if (activities.some(a => a.includes(token))) {
        score += 35;
        tokenMatched = true;
      }

      if (tokenMatched) matchedTokens += 1;
    }

    if (matchedTokens !== tokens.length) return 0;
    return score;
  }

  function getVisibleEntries() {
    const entries = [...latestEntries];

    if (!searchQuery) {
      entries.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
      return entries;
    }

    return entries
      .map(entry => ({ entry, score: scoreEntry(entry, searchQuery) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || (a.entry.displayName || "").localeCompare(b.entry.displayName || ""))
      .map(item => item.entry);
  }

  function ensureGrid() {
    if (!gridEl) {
      gridEl = document.createElement("div");
      gridEl.className = "all-card-grid";
      ensureWrapper().appendChild(gridEl);
    }
    return gridEl;
  }

  function clearRenderedResults() {
    if (gridEl) gridEl.innerHTML = "";
    const target = wrapperEl || container;
    target.querySelectorAll(".all-search-empty, .empty-state").forEach(node => node.remove());
  }

  function ensureWrapper() {
    if (!wrapperEl) {
      wrapperEl = document.createElement("div");
      wrapperEl.className = "all-tab-container";
      container.appendChild(wrapperEl);
    }
    return wrapperEl;
  }

  function updateStatLine(count) {
    const wrapper = ensureWrapper();
    if (!statLineEl) {
      statLineEl = document.createElement("div");
      statLineEl.className = "all-stat-line";
      wrapper.prepend(statLineEl);
    }
    statLineEl.textContent = `${count} ${count === 1 ? "person" : "people"} tracking this month`;
  }

  function ensureControls() {
    if (controlsMounted) return;
    controlsMounted = true;

    const controls = document.createElement("div");
    controls.className = "all-search-row";
    controls.innerHTML = `
      <input
        id="all-search-input"
        class="all-search-input"
        type="search"
        placeholder="Search people or activities"
        autocomplete="off"
      />
    `;
    ensureWrapper().appendChild(controls);

    const input = controls.querySelector("#all-search-input");
    input?.addEventListener("input", () => {
      searchQuery = input.value;
      renderAllList();
    });
  }

  function renderAllList() {
    const visibleEntries = getVisibleEntries();
    updateStatLine(latestEntries.length);
    ensureControls();
    clearRenderedResults();

    const grid = ensureGrid();

    if (visibleEntries.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state all-search-empty";
      empty.textContent = normalizeText(searchQuery)
        ? `No matches for "${searchQuery.trim()}".`
        : "No other trackers yet for this month.";
      ensureWrapper().appendChild(empty);
      return;
    }

    for (const entry of visibleEntries) {
      const isFollowing = latestFollows.has(entry.id);
      let card;
      switch (entry._tier) {
        case "followers":
          card = renderLockedCard(entry, isFollowing, currentUser);
          break;
        case "lowkey":
          card = renderLowKeyCard(entry, isFollowing, currentUser);
          break;
        case "ghost":
          card = renderGhostCard(entry, isFollowing, currentUser);
          break;
        case "sharing":
        default:
          card = renderMobileCard(entry, yearMonth, currentUser, { isFollowing, showFollowBtn: true, showMonthNav: true });
          break;
      }
      const slot = document.createElement("div");
      slot.className = "all-result-card-slot";
      slot.appendChild(card);

      // Diary strip for all tiers except Followers (locked card)
      if (entry._tier !== "followers") {
        const privacy = { calendar: entry._tier || "sharing", diary: entry._diaryTier || "sharing" };
        const signal = computeSignal(entry.displayName, entry);
        const strip = renderDiaryStrip(entry._diaryEntry, privacy, signal, { isFollowing });
        if (strip) card.appendChild(strip);
      }

      grid.appendChild(slot);
    }
  }

  return onSnapshot(entriesRef, async (snapshot) => {
    const validDocs = snapshot.docs.filter(docSnap => {
      if (docSnap.id === currentUser?.uid) return false;
      const data = docSnap.data();
      return data.activities && data.activities.length > 0;
    });

    const [userSnaps, myUserSnap] = await Promise.all([
      Promise.all(validDocs.map(docSnap => getDoc(doc(db, "users", docSnap.id)))),
      currentUser?.uid
        ? getDoc(doc(db, "users", currentUser.uid))
        : Promise.resolve(null)
    ]);

    const myFollows = new Set(
      myUserSnap?.exists() ? (myUserSnap.data().following || []) : []
    );

    // Pre-compute tiers so we know which users need diary fetches
    const entryMetas = validDocs.map((docSnap, i) => {
      const userSnap = userSnaps[i];
      if (!userSnap?.exists()) return null;
      const userData = userSnap.data();
      const calTier = userData?.calendarPrivacy || userData?.privacy?.calendar || "sharing";
      const diaryTier = userData?.diaryPrivacy || userData?.privacy?.diary || "sharing";
      if (calTier === "private" || diaryTier === "private") return null;
      return { docSnap, userData, calTier, diaryTier };
    });

    // Fetch diary entries for users with Sharing or Followers diary tier
    const diaryCache = {};
    await Promise.all(entryMetas.map(async (meta) => {
      if (!meta) return;
      if (meta.diaryTier === "lowkey" || meta.diaryTier === "ghost" || meta.diaryTier === "private") return;
      const uid = meta.docSnap.id;
      try {
        const diaryRef = collection(db, "diary", uid, "entries");
        const snap = await getDocs(diaryRef);
        const matching = snap.docs
          .filter(d => d.id.startsWith(yearMonth))
          .sort((a, b) => b.id.localeCompare(a.id));
        if (matching.length > 0) {
          const d = matching[0];
          diaryCache[uid] = { docId: d.id, ...d.data() };
        }
      } catch (_) { /* diary fetch is best-effort */ }
    }));

    const entries = entryMetas
      .map((meta) => {
        if (!meta) return null;
        const { docSnap, userData, calTier } = meta;
        const data = docSnap.data();

        const displayName = data.displayName || userData.displayName;
        const username = data.username || userData.username || displayName;

        // Decoration fallback: log doc may lack decoration for some tiers
        const decoration = (data.decoration?.color)
          ? data.decoration
          : (userData.decoration || { color: "#D8584E", fontColor: "#FFFFFF", font: "Inter", sticker: "", marker: "circle", avatarUrl: "" });

        // _searchActivities: only expose for Sharing tier searches
        const searchActivities = (calTier === "sharing")
          ? (data.activities || []).map(a => a.toLowerCase().trim())
          : [];

        const diaryTier = userData?.diaryPrivacy || userData?.privacy?.diary || "sharing";

        return {
          id: docSnap.id,
          ...data,
          displayName,
          username: username || displayName,
          decoration,
          _tier: calTier,
          _diaryTier: diaryTier,
          _diaryEntry: diaryCache[docSnap.id] || null,
          _searchActivities: searchActivities
        };
      })
      .filter(Boolean);

    latestEntries = entries;
    latestFollows = myFollows;
    renderAllList();

    hideLoader();
  }, (error) => {
    console.error("Snapshot error:", error);
    showToast("Failed to load trackers.", "error");
    hideLoader();
  });
}
