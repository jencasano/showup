import { renderFeedCard } from "./feed-card.js";
import { getPrivacy } from "./following-utils.js";

export function renderFeedView(container, model) {
  const {
    currentUser, yearMonth, followingIds, logsCache, userCache, diaryCache, onSwitchToAll,
  } = model;

  container.innerHTML = "";

  // Filter out fully-private users
  const filtered = followingIds.filter(uid => {
    const user = userCache[uid];
    const p = getPrivacy(user);
    return p.calendar !== "private" && p.diary !== "private";
  });

  // Empty state
  if (filtered.length === 0) {
    const wrap = document.createElement("div");
    wrap.className = "following-empty";
    const icon = document.createElement("div");
    icon.style.fontSize = "2rem";
    icon.textContent = "\uD83D\uDCF0";
    const heading = document.createElement("h3");
    heading.className = "following-empty-title";
    heading.textContent = "Nothing in your feed yet";
    const sub = document.createElement("p");
    sub.className = "following-empty-sub";
    sub.textContent = "Head to the All tab to find people to follow.";
    const btn = document.createElement("button");
    btn.className = "following-browse-btn";
    btn.textContent = "Browse All \u2192";
    btn.addEventListener("click", onSwitchToAll);
    wrap.append(icon, heading, sub, btn);
    container.appendChild(wrap);
    return;
  }

  // Sort: most recent active day first, no-log users at end alphabetically
  const sorted = [...filtered].sort((aUid, bUid) => {
    const aLog = logsCache[aUid];
    const bLog = logsCache[bUid];
    const aMax = maxActiveDay(aLog);
    const bMax = maxActiveDay(bLog);
    if (aMax === 0 && bMax === 0) {
      const aName = (userCache[aUid]?.displayName || "").toLowerCase();
      const bName = (userCache[bUid]?.displayName || "").toLowerCase();
      return aName.localeCompare(bName);
    }
    if (aMax === 0) return 1;
    if (bMax === 0) return -1;
    return bMax - aMax;
  });

  const stream = document.createElement("div");
  stream.className = "fw-feed-stream";

  for (const uid of sorted) {
    const user = userCache[uid] || null;
    const log = logsCache[uid] || null;
    const diaryEntry = diaryCache?.[uid] ?? null;
    stream.appendChild(renderFeedCard(uid, user, log, diaryEntry, yearMonth, currentUser));
  }

  container.appendChild(stream);
}

function maxActiveDay(log) {
  if (!log?.marks) return 0;
  let max = 0;
  for (const arr of Object.values(log.marks)) {
    if (Array.isArray(arr)) {
      for (const d of arr) { if (d > max) max = d; }
    }
  }
  return max;
}
