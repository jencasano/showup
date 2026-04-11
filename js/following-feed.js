import { renderFeedCard } from "./feed-card.js";
import { getPrivacy } from "./following-utils.js";

function actName(act) { return typeof act === "string" ? act : act.name; }

function toLocalDateStr(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

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
      windowDates.push(toLocalDateStr(d));
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

  // Group cards by date (preserve sort order within each group)
  const groups = new Map();
  for (const card of cards) {
    if (!groups.has(card.dateStr)) groups.set(card.dateStr, []);
    groups.get(card.dateStr).push(card);
  }

  const todayStr = toLocalDateStr(new Date());
  const stream = document.createElement("div");
  stream.className = "fw-feed-stream";

  let isFirst = true;
  for (const [dateStr, groupCards] of groups) {
    const section = document.createElement("div");
    section.className = "fw-feed-date-section";

    const dot = document.createElement("div");
    dot.className = "fw-feed-date-dot" + (isFirst ? " today" : "");

    const label = document.createElement("div");
    label.className = "fw-feed-date-label";
    label.textContent = formatDateLabel(dateStr);

    const cardsWrap = document.createElement("div");
    cardsWrap.className = "fw-feed-date-cards";
    let cardIdx = 0;
    for (const card of groupCards) {
      const el = renderFeedCard(card.uid, card.user, card.log, card.diaryEntry, yearMonth, currentUser, { dateStr: card.dateStr });
      el.style.animationDelay = `${cardIdx * 80}ms`;
      cardsWrap.appendChild(el);
      cardIdx++;
    }

    section.append(dot, label, cardsWrap);
    stream.appendChild(section);
    isFirst = false;
  }

  container.appendChild(stream);

  // Scroll-driven timeline glow + dot activation
  const glow = document.createElement("div");
  glow.className = "fw-feed-tl-glow";
  stream.appendChild(glow);

  const dots = stream.querySelectorAll(".fw-feed-date-dot");

  function updateTimeline() {
    const streamRect = stream.getBoundingClientRect();
    const trigger = window.innerHeight * 0.55;
    const fill = Math.max(0, Math.min(trigger - streamRect.top, stream.scrollHeight));
    glow.style.height = fill + "px";

    dots.forEach(dot => {
      const dotTop = dot.getBoundingClientRect().top;
      if (dotTop < trigger) {
        dot.classList.add("reached");
      }
    });
  }

  window.addEventListener("scroll", updateTimeline, { passive: true });
  window.addEventListener("resize", updateTimeline, { passive: true });
  setTimeout(updateTimeline, 50);
}
