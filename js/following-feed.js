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

  // Sort: most recently updated first, no-signal users at end alphabetically
  const sorted = [...filtered].sort((aUid, bUid) => {
    const aTs = lastSignalMs(logsCache[aUid], diaryCache?.[aUid]);
    const bTs = lastSignalMs(logsCache[bUid], diaryCache?.[bUid]);
    if (aTs === 0 && bTs === 0) {
      const aName = (userCache[aUid]?.displayName || "").toLowerCase();
      const bName = (userCache[bUid]?.displayName || "").toLowerCase();
      return aName.localeCompare(bName);
    }
    if (aTs === 0) return 1;
    if (bTs === 0) return -1;
    return bTs - aTs;
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

function lastSignalMs(log, diary) {
  let ms = 0;
  if (log?.lastUpdated?.toMillis) {
    ms = log.lastUpdated.toMillis();
  }
  if (diary?.lastUpdated?.toMillis) {
    const dMs = diary.lastUpdated.toMillis();
    if (dMs > ms) ms = dMs;
  } else if (diary?.docId) {
    const dMs = new Date(diary.docId + "T00:00:00").getTime();
    if (dMs > ms) ms = dMs;
  }
  return ms;
}
