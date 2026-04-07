import { db } from "./firebase-config.js";
import {
  collection, doc, getDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast, showLoader, hideLoader } from "./ui.js";
import { renderMobileCard } from "./mobile-tracker.js";

export function loadAllLogs(yearMonth, container, currentUser, silent = false) {
  if (!silent) showLoader();
  container.innerHTML = "";

  const entriesRef = collection(db, "logs", yearMonth, "entries");
  let searchQuery = "";
  let includeFollowed = true;
  let latestEntries = [];
  let latestFollows = new Set();
  let controlsMounted = false;

  function normalizeText(value) {
    return String(value || "").toLowerCase().trim();
  }

  function tokenizeQuery(query) {
    return normalizeText(query).split(/\s+/).filter(Boolean);
  }

  function scoreEntry(entry, myFollows, query) {
    const queryNorm = normalizeText(query);
    if (!queryNorm) return 0;

    const tokens = tokenizeQuery(queryNorm);
    if (tokens.length === 0) return 0;

    const name = normalizeText(entry.displayName);
    const username = normalizeText(entry.username);
    const activities = (entry.activities || []).map(normalizeText);

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

      const exactActivity = activities.some(activity => activity === token);
      if (exactActivity) {
        score += 60;
        tokenMatched = true;
      } else if (activities.some(activity => activity.includes(token))) {
        score += 35;
        tokenMatched = true;
      }

      if (tokenMatched) matchedTokens += 1;
    }

    if (matchedTokens !== tokens.length) return 0;
    if (myFollows.has(entry.id)) score += 8;
    return score;
  }

  function getVisibleEntries() {
    const entries = [...latestEntries];

    if (!searchQuery) {
      entries.sort((a, b) => {
        const aF = latestFollows.has(a.id), bF = latestFollows.has(b.id);
        if (aF && !bF) return -1;
        if (!aF && bF) return 1;
        return (a.displayName || "").localeCompare(b.displayName || "");
      });
      return entries;
    }

    const filtered = entries
      .filter(entry => includeFollowed || !latestFollows.has(entry.id))
      .map(entry => ({ entry, score: scoreEntry(entry, latestFollows, searchQuery) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || (a.entry.displayName || "").localeCompare(b.entry.displayName || ""))
      .map(item => item.entry);

    return filtered;
  }

  function clearRenderedResults() {
    container.querySelectorAll(".all-result-card-slot, .all-search-empty, .empty-state").forEach(node => node.remove());
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
      <label class="all-search-toggle">
        <input id="all-search-include-followed" type="checkbox" ${includeFollowed ? "checked" : ""} />
        <span>Include followed</span>
      </label>
    `;
    container.appendChild(controls);

    const input = controls.querySelector("#all-search-input");
    const includeToggle = controls.querySelector("#all-search-include-followed");

    input?.addEventListener("input", () => {
      searchQuery = input.value;
      renderAllList();
    });

    includeToggle?.addEventListener("change", () => {
      includeFollowed = includeToggle.checked;
      renderAllList();
    });
  }

  function renderAllList() {
    const visibleEntries = getVisibleEntries();
    ensureControls();
    clearRenderedResults();

    if (visibleEntries.length === 0) {
      const queryLabel = normalizeText(searchQuery);
      const empty = document.createElement("p");
      empty.className = "empty-state all-search-empty";
      empty.textContent = queryLabel
        ? `No matches for "${searchQuery.trim()}".`
        : "No other trackers yet for this month.";
      container.appendChild(empty);
      return;
    }

    for (const entry of visibleEntries) {
      const isFollowing = latestFollows.has(entry.id);
      const card = renderMobileCard(entry, yearMonth, currentUser, { isFollowing, showFollowBtn: true });
      const slot = document.createElement("div");
      slot.className = "all-result-card-slot";
      slot.appendChild(card);
      container.appendChild(slot);
    }
  }

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

    const [userSnaps, myUserSnap] = await Promise.all([
      Promise.all(validDocs.map(docSnap => getDoc(doc(db, "users", docSnap.id)))),
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
        const userSnap = userSnaps[i];
        if (!userSnap?.exists()) return null;
        const userData = userSnap.data();

        // Enforce followers-only tier: hide from non-followers
        const calTier = userData?.privacy?.calendar || "sharing";
        if (calTier === "followers" && !myFollows.has(docSnap.id)) return null;

        const displayName = data.displayName || userData.displayName;
        const username    = data.username    || userData.username || displayName;
        return { id: docSnap.id, ...data, displayName, username: username || displayName };
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
