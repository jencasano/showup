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

// ── Compute card list from model ─────────────────────

function computeCardList(model) {
  const { followingIds, logsCache, userCache, diaryCache, yearMonth } = model;

  const filtered = followingIds.filter(uid => {
    const user = userCache[uid];
    const p = getPrivacy(user);
    return p.calendar !== "private" && p.diary !== "private";
  });

  const now = new Date();
  const [ym_y, ym_m] = yearMonth.split("-").map(Number);
  const windowDates = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    if (d.getFullYear() === ym_y && d.getMonth() + 1 === ym_m) {
      windowDates.push(toLocalDateStr(d));
    }
  }

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

      let ms = 0;
      if (log?.lastUpdated?.toMillis) ms = log.lastUpdated.toMillis();
      if (diaryEntry?.lastUpdated?.toMillis) {
        const dMs = diaryEntry.lastUpdated.toMillis();
        if (dMs > ms) ms = dMs;
      }
      if (ms === 0) ms = new Date(dateStr + "T00:00:00").getTime();

      cards.push({ uid, user, log, diaryEntry, dateStr, ms });
    }
  }

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

  const groups = new Map();
  for (const card of cards) {
    if (!groups.has(card.dateStr)) groups.set(card.dateStr, []);
    groups.get(card.dateStr).push(card);
  }

  return { filtered, cards, groups };
}

// ── Timeline glow + dot listener ─────────────────────

function attachTimelineListeners(stream) {
  const glow = stream.querySelector(".fw-feed-tl-glow");
  const dots = stream.querySelectorAll(".fw-feed-date-dot");

  function updateTimeline() {
    const streamRect = stream.getBoundingClientRect();
    const trigger = window.innerHeight * 0.55;
    const fill = Math.max(0, Math.min(trigger - streamRect.top, stream.scrollHeight));
    if (glow) glow.style.height = fill + "px";

    dots.forEach(dot => {
      const dotTop = dot.getBoundingClientRect().top;
      if (dotTop < trigger) dot.classList.add("reached");
    });
  }

  window.addEventListener("scroll", updateTimeline, { passive: true });
  window.addEventListener("resize", updateTimeline, { passive: true });
  setTimeout(updateTimeline, 50);

  return () => {
    window.removeEventListener("scroll", updateTimeline);
    window.removeEventListener("resize", updateTimeline);
  };
}

// ── Fingerprinting ───────────────────────────────────

function visibleDayRange(dateStr) {
  const anchorDay = parseInt(dateStr.slice(-2), 10);
  const startDay = Math.max(1, anchorDay - 6);
  return { startDay, anchorDay };
}

function calMarksSnapshot(log, dateStr) {
  if (!log?.marks || !log?.activities) return {};
  const { startDay, anchorDay } = visibleDayRange(dateStr);
  const snap = {};
  for (const act of log.activities) {
    const name = actName(act);
    const marks = log.marks[name] || [];
    snap[name] = marks.filter(d => d >= startDay && d <= anchorDay);
  }
  return snap;
}

function diffMarks(oldSnap, newSnap) {
  const changed = new Set();
  const allActivities = new Set([...Object.keys(oldSnap), ...Object.keys(newSnap)]);
  for (const act of allActivities) {
    const oldDays = new Set(oldSnap[act] || []);
    const newDays = new Set(newSnap[act] || []);
    for (const d of newDays) {
      if (!oldDays.has(d)) changed.add(`${act}-${d}`);
    }
  }
  return changed;
}

function diaryFingerprint(diaryEntry) {
  if (!diaryEntry) return "";
  return (diaryEntry.note || "").slice(0, 80) + "|" + (diaryEntry.photoUrl || "");
}

// ── Render helpers ───────────────────────────────────

function makeCardEl(card, model, { isNew, changedDots, diaryChanged } = {}) {
  const opts = { dateStr: card.dateStr };
  if (isNew) { opts.diaryUpdated = true; opts.changedDots = null; }
  else { opts.diaryUpdated = diaryChanged; opts.changedDots = changedDots || null; }

  const el = renderFeedCard(card.uid, card.user, card.log, card.diaryEntry, model.yearMonth, model.currentUser, opts);
  el.dataset.cardKey = `${card.uid}-${card.dateStr}`;
  el.dataset.calMarks = JSON.stringify(calMarksSnapshot(card.log, card.dateStr));
  el.dataset.diaryFp = diaryFingerprint(card.diaryEntry);

  if (isNew) {
    el.classList.add("fw-feed-card-enter");
    el.addEventListener("animationend", () => el.classList.remove("fw-feed-card-enter"), { once: true });
  }
  return el;
}

function makeDateSection(dateStr, isFirst, isNew) {
  const section = document.createElement("div");
  section.className = "fw-feed-date-section";
  section.dataset.date = dateStr;
  if (isNew) {
    section.classList.add("fw-feed-date-section-enter");
    section.addEventListener("animationend", () => section.classList.remove("fw-feed-date-section-enter"), { once: true });
  }

  const dot = document.createElement("div");
  dot.className = "fw-feed-date-dot" + (isFirst ? " today" : "");

  const label = document.createElement("div");
  label.className = "fw-feed-date-label";
  label.textContent = formatDateLabel(dateStr);

  const cardsWrap = document.createElement("div");
  cardsWrap.className = "fw-feed-date-cards";

  section.append(dot, label, cardsWrap);
  return section;
}

function renderEmptyState(container, model) {
  container.innerHTML = "";
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
  btn.addEventListener("click", model.onSwitchToAll);
  wrap.append(icon, heading, sub, btn);
  container.appendChild(wrap);
}

// ── Full build (first render) ────────────────────────

function buildFeedFromScratch(container, model) {
  container.innerHTML = "";
  const { cards, groups } = computeCardList(model);

  if (cards.length === 0) {
    renderEmptyState(container, model);
    return;
  }

  const stream = document.createElement("div");
  stream.className = "fw-feed-stream";

  let isFirst = true;
  for (const [dateStr, groupCards] of groups) {
    const section = makeDateSection(dateStr, isFirst, true);
    const cardsWrap = section.querySelector(".fw-feed-date-cards");

    let cardIdx = 0;
    for (const card of groupCards) {
      const el = makeCardEl(card, model, { isNew: true });
      el.style.animationDelay = `${cardIdx * 80}ms`;
      cardsWrap.appendChild(el);
      cardIdx++;
    }

    stream.appendChild(section);
    isFirst = false;
  }

  container.appendChild(stream);

  const glow = document.createElement("div");
  glow.className = "fw-feed-tl-glow";
  stream.appendChild(glow);

  stream._tlCleanup = attachTimelineListeners(stream);
}

// ── Incremental update ───────────────────────────────

function updateFeedInPlace(stream, model) {
  const { cards, groups } = computeCardList(model);

  if (cards.length === 0) {
    if (stream._tlCleanup) stream._tlCleanup();
    const container = stream.parentElement;
    renderEmptyState(container, model);
    return;
  }

  // Persistent unseen change tracking
  if (!stream._unseenDots) stream._unseenDots = new Map();
  if (!stream._unseenDiary) stream._unseenDiary = new Set();

  // Map existing cards by key
  const existingCards = new Map();
  stream.querySelectorAll("[data-card-key]").forEach(el => {
    existingCards.set(el.dataset.cardKey, el);
  });

  // Map existing sections by date
  const existingSections = new Map();
  stream.querySelectorAll("[data-date]").forEach(el => {
    existingSections.set(el.dataset.date, el);
  });

  const visitedKeys = new Set();
  const visitedDates = new Set();
  let isFirst = true;

  for (const [dateStr, groupCards] of groups) {
    visitedDates.add(dateStr);

    // Reuse or create date section
    let section = existingSections.get(dateStr);
    if (!section) {
      section = makeDateSection(dateStr, isFirst, true);
    }

    const cardsWrap = section.querySelector(".fw-feed-date-cards");

    // Build new card elements for this group (in sorted order)
    const orderedEls = [];
    for (const card of groupCards) {
      const key = `${card.uid}-${card.dateStr}`;
      visitedKeys.add(key);

      const existingEl = existingCards.get(key);

      // Detect new changes and accumulate into unseen sets
      if (existingEl) {
        const oldSnap = JSON.parse(existingEl.dataset.calMarks || "{}");
        const newSnap = calMarksSnapshot(card.log, card.dateStr);
        const dots = diffMarks(oldSnap, newSnap);
        if (dots.size > 0) {
          const prev = stream._unseenDots.get(key) || new Set();
          dots.forEach(d => prev.add(d));
          stream._unseenDots.set(key, prev);
        }
        if (existingEl.dataset.diaryFp !== diaryFingerprint(card.diaryEntry)) {
          stream._unseenDiary.add(key);
        }
      }

      // Build card with accumulated unseen markers
      const newEl = makeCardEl(card, model, {
        isNew: !existingEl,
        changedDots: stream._unseenDots.get(key) || null,
        diaryChanged: stream._unseenDiary.has(key),
      });
      orderedEls.push(newEl);

      if (existingEl) {
        existingEl.replaceWith(newEl);
      }
      // New cards are not appended yet -- handled below in reorder step
    }

    // Remove cards in this section that are no longer in the data
    cardsWrap.querySelectorAll("[data-card-key]").forEach(el => {
      if (!visitedKeys.has(el.dataset.cardKey)) el.remove();
    });

    // Reorder: re-append in correct sort order (moves existing nodes)
    for (const el of orderedEls) {
      cardsWrap.appendChild(el);
    }

    // Reorder: appendChild moves existing nodes without destroying them
    stream.appendChild(section);
    isFirst = false;
  }

  // Remove date sections that are no longer in the data
  existingSections.forEach((section, dateStr) => {
    if (!visitedDates.has(dateStr)) section.remove();
  });

  // Re-append glow at the end
  const glow = stream.querySelector(".fw-feed-tl-glow");
  if (glow) stream.appendChild(glow);

  // Re-attach timeline listeners
  if (stream._tlCleanup) stream._tlCleanup();
  stream._tlCleanup = attachTimelineListeners(stream);
}

// ── Main export ──────────────────────────────────────

export function renderFeedView(container, model) {
  const existingStream = container.querySelector(".fw-feed-stream");

  if (!existingStream) {
    buildFeedFromScratch(container, model);
  } else {
    updateFeedInPlace(existingStream, model);
  }
}
