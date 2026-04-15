import { renderFeedEvent } from "./feed-event.js";
import { getPrivacy } from "./following-utils.js";

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

// ── Compute event list from model ───────────────────

function computeEventList(model) {
  const { feedEvents, userCache } = model;

  // Filter out private-tier users
  const events = feedEvents.filter(evt => {
    const user = evt.user || userCache[evt.uid];
    const p = getPrivacy(user);
    if (evt.type === "log" && p.calendar === "private") return false;
    if (evt.type === "diary" && p.diary === "private") return false;
    return true;
  });

  // Sort newest first
  events.sort((a, b) => b.firedAt - a.firedAt);

  // Group by dateStr
  const groups = new Map();
  for (const evt of events) {
    if (!groups.has(evt.dateStr)) groups.set(evt.dateStr, []);
    groups.get(evt.dateStr).push(evt);
  }

  return { events, groups };
}

// ── Timeline glow + dot listener ────────────────────

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

// ── Render helpers ──────────────────────────────────

function makeEventEl(evt, model, isNew) {
  const el = renderFeedEvent(evt, model.currentUser);
  el.dataset.evtKey = evt.key;

  if (isNew) {
    el.classList.add("fw-feed-evt-enter");
    el.addEventListener("animationend", () => el.classList.remove("fw-feed-evt-enter"), { once: true });
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

// ── Full build (first render) ───────────────────────

function buildFeedFromScratch(container, model) {
  container.innerHTML = "";
  const { events, groups } = computeEventList(model);

  if (events.length === 0) {
    renderEmptyState(container, model);
    return;
  }

  const stream = document.createElement("div");
  stream.className = "fw-feed-stream";

  let isFirst = true;
  for (const [dateStr, groupEvents] of groups) {
    const section = makeDateSection(dateStr, isFirst, true);
    const cardsWrap = section.querySelector(".fw-feed-date-cards");

    let idx = 0;
    for (const evt of groupEvents) {
      const el = makeEventEl(evt, model, true);
      el.style.animationDelay = `${idx * 80}ms`;
      cardsWrap.appendChild(el);
      idx++;
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

// ── Incremental update ──────────────────────────────

function updateFeedInPlace(stream, model) {
  const { events, groups } = computeEventList(model);

  if (events.length === 0) {
    if (stream._tlCleanup) stream._tlCleanup();
    const container = stream.parentElement;
    renderEmptyState(container, model);
    return;
  }

  // Map existing event elements by key
  const existingEls = new Map();
  stream.querySelectorAll("[data-evt-key]").forEach(el => {
    existingEls.set(el.dataset.evtKey, el);
  });

  // Map existing sections by date
  const existingSections = new Map();
  stream.querySelectorAll("[data-date]").forEach(el => {
    existingSections.set(el.dataset.date, el);
  });

  const visitedKeys = new Set();
  const visitedDates = new Set();
  let isFirst = true;

  for (const [dateStr, groupEvents] of groups) {
    visitedDates.add(dateStr);

    let section = existingSections.get(dateStr);
    if (!section) {
      section = makeDateSection(dateStr, isFirst, true);
    }

    const cardsWrap = section.querySelector(".fw-feed-date-cards");

    const orderedEls = [];
    for (const evt of groupEvents) {
      visitedKeys.add(evt.key);
      const existingEl = existingEls.get(evt.key);

      // Always rebuild -- events carry fresh data
      const newEl = makeEventEl(evt, model, !existingEl);
      orderedEls.push(newEl);

      if (existingEl) {
        existingEl.replaceWith(newEl);
      }
    }

    // Remove event elements no longer present
    cardsWrap.querySelectorAll("[data-evt-key]").forEach(el => {
      if (!visitedKeys.has(el.dataset.evtKey)) el.remove();
    });

    // Reorder
    for (const el of orderedEls) {
      cardsWrap.appendChild(el);
    }

    stream.appendChild(section);
    isFirst = false;
  }

  // Remove stale date sections
  existingSections.forEach((section, dateStr) => {
    if (!visitedDates.has(dateStr)) section.remove();
  });

  // Re-append glow
  const glow = stream.querySelector(".fw-feed-tl-glow");
  if (glow) stream.appendChild(glow);

  // Re-attach timeline listeners
  if (stream._tlCleanup) stream._tlCleanup();
  stream._tlCleanup = attachTimelineListeners(stream);
}

// ── Main export ─────────────────────────────────────

export function renderFeedView(container, model) {
  const existingStream = container.querySelector(".fw-feed-stream");

  if (!existingStream) {
    buildFeedFromScratch(container, model);
  } else {
    updateFeedInPlace(existingStream, model);
  }
}
