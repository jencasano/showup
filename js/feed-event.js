// feed-event.js -- Build and render feed events for the event-stream model

import { getPrivacy, renderTierBadge } from "./following-utils.js";
import { computeSignal } from "./following-signals.js";
import { resolveFeedCopy, fillFeedCopy } from "./feed-copy.js";

// ── Helpers ─────────────────────────────────────────

function actName(act) { return typeof act === "string" ? act : act.name; }

function formatEventTime(ts) {
  if (!ts) return "";
  const ms = typeof ts === "number" ? ts : ts.toMillis ? ts.toMillis() : ts;
  const d = new Date(ms);
  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dDay = new Date(d);
  dDay.setHours(0, 0, 0, 0);

  if (dDay.getTime() === today.getTime()) return `today at ${timeStr}`;
  if (dDay.getTime() === yesterday.getTime()) return `yesterday at ${timeStr}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ` at ${timeStr}`;
}

function formatBackfillDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.getTime() === today.getTime()) return "today";
  if (d.getTime() === yesterday.getTime()) return "yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Activity name collapsing (Sharing tier only) ────

export function collapseActivities(activities) {
  if (!activities || activities.length === 0) return "";
  const names = activities.map(a => actName(a));
  if (names.length === 1) return `<em>${names[0]}</em>`;
  if (names.length === 2) return `<em>${names[0]}</em> and <em>${names[1]}</em>`;
  if (names.length === 3) return `<em>${names[0]}</em>, <em>${names[1]}</em>, and <em>${names[2]}</em>`;
  const remaining = names.length - 2;
  return `<em>${names[0]}</em>, <em>${names[1]}</em>, and ${remaining} more`;
}

// Get activities that have at least one mark this month
function getMarkedActivities(log) {
  if (!log?.activities || !log?.marks) return [];
  return log.activities.filter(act => {
    const name = actName(act);
    return (log.marks[name] || []).length > 0;
  });
}

// ── Event builders ──────────────────────────────────

function extractMs(obj) {
  if (obj?.lastUpdated?.toMillis) return obj.lastUpdated.toMillis();
  if (obj?.lastUpdated?.seconds)  return obj.lastUpdated.seconds * 1000;
  return 0;
}

// Find the most recent mark across all activities by scanning log.markTimes.
// Returns { ms, day } or null when markTimes is missing/empty (older docs).
function findLatestMark(log) {
  const mt = log?.markTimes;
  if (!mt) return null;
  let bestMs = 0;
  let bestDay = null;
  for (const dayMap of Object.values(mt)) {
    if (!dayMap) continue;
    for (const [dayStr, ts] of Object.entries(dayMap)) {
      if (typeof ts !== "number") continue;
      if (ts > bestMs) {
        bestMs = ts;
        bestDay = parseInt(dayStr, 10);
      }
    }
  }
  if (!bestMs || bestDay == null) return null;
  return { ms: bestMs, day: bestDay };
}

export function buildLogEvent(uid, user, log, yearMonth, dateStr, opts = {}) {
  // No marks anywhere -- nothing to event on. A bare setup doc shouldn't
  // produce a "showed up" item in the feed.
  const marks = log?.marks || {};
  const hasAnyMark = Object.values(marks).some(arr => Array.isArray(arr) && arr.length > 0);
  if (!hasAnyMark) return null;

  const { batchId: optBatchId, burstActivities, burstFiredAt, burstDateStr } = opts;
  const isBurst = optBatchId != null;

  // Burst mode: caller has identified a specific debounce burst and supplies
  // its identity. Historical mode: derive identity from the most recent
  // markTimes entry so we get one stable card per person on initial load.
  const latest = findLatestMark(log);
  let ds, firedAt, batchId, keySuffix;

  if (isBurst) {
    batchId = optBatchId;
    firedAt = burstFiredAt || latest?.ms || extractMs(log) || Date.now();
    ds = burstDateStr
      || (latest ? `${yearMonth}-${String(latest.day).padStart(2, "0")}` : null)
      || dateStr
      || new Date().toISOString().slice(0, 10);
    keySuffix = batchId;
  } else {
    ds = latest
      ? `${yearMonth}-${String(latest.day).padStart(2, "0")}`
      : (dateStr || new Date().toISOString().slice(0, 10));
    firedAt = latest?.ms || extractMs(log) || Date.now();
    // Old docs without markTimes can't produce a stable batchId -- fall back
    // to the dateStr-based key (preserves prior one-card-per-day behavior).
    batchId = latest?.ms || null;
    keySuffix = batchId != null ? batchId : ds;
  }

  return {
    type: "log",
    uid,
    user,
    log,
    burstActivities: burstActivities || null,
    diaryEntry: null,
    dateStr: ds,
    yearMonth,
    firedAt,
    batchId,
    key: `${uid}-log-${keySuffix}`,
  };
}

export function buildDiaryEvent(uid, user, diaryEntry, dateStr) {
  return {
    type: "diary",
    uid,
    user,
    log: null,
    diaryEntry,
    dateStr,
    firedAt: extractMs(diaryEntry) || Date.now(),
    key: `${uid}-diary-${dateStr}`,
  };
}

// ── Renderer ────────────────────────────────────────

export function renderFeedEvent(event, currentUser) {
  const { type, uid, user, log, diaryEntry, dateStr, burstActivities, firedAt } = event;
  const displayName = user?.displayName || "Unknown";
  const firstName = (displayName || "").split(" ")[0] || displayName;
  const privacy = getPrivacy(user);
  const tier = type === "diary" ? privacy.diary : privacy.calendar;
  const deco = log?.decoration || user?.decoration || { color: "#C3342B", fontColor: "#FFFFFF" };

  // Compute signal context from log data
  const signal = computeSignal(displayName, log, {
    lastActiveDate: user?.lastActiveDate,
    prevActiveDate: user?.prevActiveDate,
  });
  const contextKey = signal.contextKey || "default";

  // Determine diary sub-context: today vs past
  let copyContext = contextKey;
  if (type === "diary") {
    const today = new Date().toISOString().slice(0, 10);
    copyContext = dateStr === today ? "today" : "past";
  }

  // Resolve and fill copy
  const tierKey = tier === "followers" ? "sharing" : tier;
  const rawCopy = resolveFeedCopy(tierKey, type, copyContext, uid, dateStr);

  let displayActivities = [];
  if (type === "log") {
    displayActivities = (burstActivities && burstActivities.length > 0)
      ? burstActivities
      : getMarkedActivities(log);
  }
  const activitiesHtml = collapseActivities(displayActivities);
  const dateLabel = formatBackfillDate(dateStr);

  const filledCopy = fillFeedCopy(rawCopy, {
    firstName,
    activities: activitiesHtml,
    date: dateLabel,
  });

  // ── Build DOM ──
  const el = document.createElement("div");
  el.className = "fw-feed-evt";
  if (tier === "ghost")       el.classList.add("fw-feed-evt--ghost");
  else if (tier === "lowkey") el.classList.add("fw-feed-evt--lowkey");
  else                        el.classList.add("fw-feed-evt--sharing");

  // Header row: avatar + name/time column + tier badge
  const head = document.createElement("div");
  head.className = "fw-feed-evt-head";

  const avatar = document.createElement("div");
  avatar.className = "fw-feed-evt-avatar";
  avatar.style.background = deco.color;
  avatar.style.color = deco.fontColor || "#FFFFFF";
  if (deco.avatarUrl) {
    const img = document.createElement("img");
    img.src = deco.avatarUrl;
    img.alt = displayName;
    avatar.appendChild(img);
  } else {
    avatar.textContent = displayName.charAt(0).toUpperCase();
  }

  const nameCol = document.createElement("div");
  nameCol.className = "fw-feed-evt-name-col";

  const nameEl = document.createElement("div");
  nameEl.className = "fw-feed-evt-name";
  nameEl.textContent = displayName;

  const timeEl = document.createElement("div");
  timeEl.className = "fw-feed-evt-time";
  // Timestamp from the event source. For log events, prefer firedAt (the
  // burst's latest mark) so multiple cards from the same person on the same
  // day show their own moment, not the doc's lastUpdated.
  const ts = type === "diary"
    ? diaryEntry?.lastUpdated
    : (firedAt || log?.lastUpdated);
  let timeText = formatEventTime(ts);

  // Ghost tier: no separate timestamp (folds into copy)
  if (tier === "ghost") timeText = "";

  // Edited flag for diary
  if (type === "diary" && diaryEntry?.editedAt) {
    timeText += " \u00b7 edited";
  }
  timeEl.textContent = timeText;

  nameCol.append(nameEl, timeEl);

  const badge = renderTierBadge(tier);

  head.append(avatar, nameCol, badge);
  el.appendChild(head);

  // Body: action line
  const body = document.createElement("div");
  body.className = "fw-feed-evt-body";

  if (tier === "ghost") {
    const ghostCopy = document.createElement("div");
    ghostCopy.className = "fw-feed-evt-ghost-copy";
    ghostCopy.textContent = filledCopy;
    body.appendChild(ghostCopy);
  } else {
    const action = document.createElement("div");
    action.className = "fw-feed-evt-action";
    action.innerHTML = filledCopy;
    body.appendChild(action);
  }

  el.appendChild(body);

  // Links row (Sharing/Followers tier only)
  if (tierKey === "sharing" && tier !== "ghost") {
    const links = document.createElement("div");
    links.className = "fw-feed-evt-links";

    if (type === "log") {
      const calLink = document.createElement("a");
      calLink.className = "fw-feed-evt-link fw-feed-evt-link--cal";
      calLink.textContent = "\uD83D\uDCC5 View Calendar";
      calLink.href = "#";
      calLink.addEventListener("click", (e) => {
        e.preventDefault();
        // Navigate to user's calendar -- handled by existing routing
      });
      links.appendChild(calLink);
    } else {
      const diaryLink = document.createElement("a");
      diaryLink.className = "fw-feed-evt-link fw-feed-evt-link--diary";
      diaryLink.textContent = "\uD83D\uDCD3 Read entry";
      diaryLink.href = "#";
      diaryLink.addEventListener("click", (e) => {
        e.preventDefault();
        // Navigate to diary entry -- handled by existing routing
      });
      links.appendChild(diaryLink);
    }

    el.appendChild(links);
  }

  return el;
}
