import { renderFeedCard } from "./feed-card.js";
import { getPrivacy } from "./following-utils.js";

function actName(act) { return typeof act === "string" ? act : act.name; }

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

  // Build rolling window dates (up to 3 days, capped to current month)
  const now = new Date();
  const [ym_y, ym_m] = yearMonth.split("-").map(Number);
  const windowDates = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    if (d.getFullYear() === ym_y && d.getMonth() + 1 === ym_m) {
      windowDates.push(d.toISOString().slice(0, 10));
    }
  }

  // Build per-day card entries
  const cards = [];
  for (const uid of filtered) {
    const user = userCache[uid] || null;
    const log = logsCache[uid] || null;
    const diaryByDate = diaryCache?.[uid] || {};

    for (const dateStr of windowDates) {
      const dayNum = parseInt(dateStr.slice(-2), 10);
      const diaryEntry = diaryByDate[dateStr] || null;
      const hasLogMarks = log?.activities?.some(act =>
        (log.marks?.[actName(act)] || []).includes(dayNum)
      );

      console.log("[feed]", uid, dateStr, "dayNum:", dayNum, "hasLog:", hasLogMarks, "diary:", !!diaryEntry, "log marks:", log?.marks);
      if (!hasLogMarks && !diaryEntry) continue;

      // Compute sort key: most recent lastUpdated between log and diary
      let ms = 0;
      if (log?.lastUpdated?.toMillis) ms = log.lastUpdated.toMillis();
      if (diaryEntry?.lastUpdated?.toMillis) {
        const dMs = diaryEntry.lastUpdated.toMillis();
        if (dMs > ms) ms = dMs;
      }
      // Fallback: use the date itself at start-of-day
      if (ms === 0) ms = new Date(dateStr + "T00:00:00").getTime();

      cards.push({ uid, user, log, diaryEntry, dateStr, ms });
    }
  }

  // Sort by lastUpdated descending, alphabetical fallback
  cards.sort((a, b) => {
    if (a.ms === 0 && b.ms === 0) {
      const aName = (a.user?.displayName || "").toLowerCase();
      const bName = (b.user?.displayName || "").toLowerCase();
      return aName.localeCompare(bName);
    }
    if (a.ms === 0) return 1;
    if (b.ms === 0) return -1;
    return b.ms - a.ms;
  });

  const stream = document.createElement("div");
  stream.className = "fw-feed-stream";

  for (const card of cards) {
    stream.appendChild(
      renderFeedCard(card.uid, card.user, card.log, card.diaryEntry, yearMonth, currentUser, { dateStr: card.dateStr })
    );
  }

  container.appendChild(stream);
}
