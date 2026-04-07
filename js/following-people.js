import { computeSignal } from "./following-signals.js";
import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getDiaryDays, getDiaryEntry } from "./diary.js";
import { getPrevYearMonth, getNextYearMonth } from "./utils.js";

// ── Privacy helpers ────────────────────────────────────

function getPrivacy(userDoc) {
  const p = userDoc?.privacy || {};
  return {
    calendar: p.calendar || "sharing",
    diary:    p.diary    || "sharing",
  };
}

const TIER_META = {
  sharing:   { label: "Sharing",   cls: "fw-tier-sharing"   },
  followers: { label: "Followers", cls: "fw-tier-followers" },
  lowkey:    { label: "Low Key",   cls: "fw-tier-lowkey"    },
  ghost:     { label: "Ghost",     cls: "fw-tier-ghost"     },
  private:   { label: "Private",   cls: "fw-tier-private"   },
};

function renderTierBadge(tier) {
  const meta = TIER_META[tier] || TIER_META.sharing;
  const span = document.createElement("span");
  span.className = `fw-tier-badge ${meta.cls}`;
  span.textContent = meta.label;
  return span;
}

// ── Data helpers ───────────────────────────────────────

function countUniqueDays(log) {
  if (!log?.marks) return 0;
  const days = new Set();
  for (const arr of Object.values(log.marks)) {
    if (Array.isArray(arr)) arr.forEach(d => days.add(d));
  }
  return days.size;
}

function shortMonthLabel(yearMonth) {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en-US", { month: "short" });
}

function formatDay(yearMonth, day) {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric"
  });
}

// ── Mini Calendar ─────────────────────────────────────

function renderMiniCal(log, yearMonth, compact = false) {
  const wrap = document.createElement("div");

  if (!log) {
    wrap.className = "fw-mini-cal fw-mini-cal--empty";
    wrap.textContent = "No tracker this month.";
    return wrap;
  }

  wrap.className = compact ? "fw-mini-cal fw-mini-cal--compact" : "fw-mini-cal";

  const [year, month] = yearMonth.split("-").map(Number);
  const daysInMonth   = new Date(year, month, 0).getDate();
  const firstDow      = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const now           = new Date();
  const isThisMonth   = now.getFullYear() === year && now.getMonth() + 1 === month;
  const todayDate     = now.getDate();

  // Build day → [color, …] map from marks + activities
  const dayColors = new Map();
  if (log.marks && Array.isArray(log.activities)) {
    for (const activity of log.activities) {
      const days = log.marks[activity.name];
      if (!Array.isArray(days)) continue;
      for (const day of days) {
        if (!dayColors.has(day)) dayColors.set(day, []);
        dayColors.get(day).push(activity.color);
      }
    }
  }

  // Day-of-week header row
  const dowRow = document.createElement("div");
  dowRow.className = "fw-cal-dow-row";
  for (const lbl of ["S", "M", "T", "W", "T", "F", "S"]) {
    const cell = document.createElement("div");
    cell.className = "fw-cal-dow";
    cell.textContent = lbl;
    dowRow.appendChild(cell);
  }
  wrap.appendChild(dowRow);

  // Day grid
  const grid = document.createElement("div");
  grid.className = "fw-cal-days";

  // Leading spacers
  for (let i = 0; i < firstDow; i++) {
    const spacer = document.createElement("div");
    spacer.className = "fw-cal-day";
    grid.appendChild(spacer);
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    cell.className = "fw-cal-day";
    if (isThisMonth && day === todayDate)    cell.classList.add("fw-cal-day--today");
    else if (isThisMonth && day > todayDate) cell.classList.add("fw-cal-day--future");

    const num = document.createElement("span");
    num.textContent = day;
    cell.appendChild(num);

    const colors = dayColors.get(day);
    if (colors?.length) {
      const dotRow = document.createElement("div");
      dotRow.className = "fw-cal-dot-row";
      for (const color of colors) {
        const dot = document.createElement("span");
        dot.className = "fw-cal-dot";
        dot.style.background = color;
        dotRow.appendChild(dot);
      }
      cell.appendChild(dotRow);
    }

    grid.appendChild(cell);
  }

  wrap.appendChild(grid);

  return wrap;
}

// ── Calendar Footer (legend) ──────────────────────────

function renderCalFooter(log) {
  if (!Array.isArray(log?.activities) || log.activities.length === 0) return null;
  const footer = document.createElement("div");
  footer.className = "fw-pinned-footer";
  const legend = document.createElement("div");
  legend.className = "fw-cal-legend";
  for (const activity of log.activities) {
    const item = document.createElement("div");
    item.className = "fw-cal-legend-item";
    const dot = document.createElement("span");
    dot.className = "fw-cal-legend-dot";
    dot.style.background = activity.color;
    const name = document.createElement("span");
    name.textContent = activity.name;
    item.append(dot, name);
    legend.appendChild(item);
  }
  footer.appendChild(legend);
  return footer;
}

// ── Diary Panel ───────────────────────────────────────

function renderDiaryPanel(uid, yearMonth) {
  const panel = document.createElement("div");
  panel.className = "fw-diary-panel";

  const lbl = document.createElement("div");
  lbl.className = "fw-diary-panel-lbl";
  lbl.textContent = "Diary.";

  const text = document.createElement("div");
  text.className = "fw-diary-panel-text";
  text.textContent = "\u2026";

  const date = document.createElement("div");
  date.className = "fw-diary-panel-date";

  const link = document.createElement("button");
  link.className = "fw-diary-panel-link";
  link.textContent = "View diary \u2192";
  link.addEventListener("click", (e) => e.stopPropagation());

  panel.append(lbl, text, date, link);

  (async () => {
    try {
      const days = await getDiaryDays(uid, yearMonth);
      if (days.size === 0) { panel.remove(); return; }
      const latestDay = Math.max(...days);
      const entry = await getDiaryEntry(uid, yearMonth, latestDay);
      if (entry?.note) {
        text.textContent = entry.note;
        date.textContent = formatDay(yearMonth, latestDay);
      } else {
        panel.remove();
      }
    } catch {
      panel.remove();
    }
  })();

  return panel;
}

// ── Signal Block ──────────────────────────────────────

function renderSignalBlock(signal, withDiary = false) {
  const block = document.createElement("div");
  block.className = withDiary
    ? "fw-signal-block fw-signal-block--with-diary"
    : "fw-signal-block";

  const headline = document.createElement("p");
  headline.className = "fw-signal-headline";
  headline.textContent = signal.headline;

  block.appendChild(headline);
  return block;
}

// ── Browse Nudge Card ──────────────────────────────────

function renderBrowseNudge(onSwitchToAll) {
  const card = document.createElement("div");
  card.className = "fw-nudge-card";

  const iconEl = document.createElement("div");
  iconEl.className = "fw-nudge-icon";
  iconEl.textContent = "\uD83D\uDC65";

  const title = document.createElement("div");
  title.className = "fw-nudge-title";
  title.textContent = "Find people to follow";

  const sub = document.createElement("div");
  sub.className = "fw-nudge-sub";
  sub.textContent = "Head to the All tab to discover who else is showing up.";

  const btn = document.createElement("button");
  btn.className = "fw-nudge-btn";
  btn.textContent = "Browse All";
  btn.addEventListener("click", onSwitchToAll);

  card.append(iconEl, title, sub, btn);
  return card;
}

// ── Pinned Card ────────────────────────────────────────

function renderPinnedCard(uid, user, log, yearMonth, currentUser) {
  const displayName = user?.displayName || "Unknown";
  const initial     = displayName.charAt(0).toUpperCase();
  const avatarUrl   = user?.decoration?.avatarUrl;
  const privacy     = getPrivacy(user);
  const signal      = computeSignal(displayName, log);

  // Privacy access booleans
  const calFull    = ["sharing", "followers"].includes(privacy.calendar);
  const calSignal  = privacy.calendar === "lowkey";
  const diaryFull  = ["sharing", "followers"].includes(privacy.diary);
  const diarySignal = privacy.diary === "lowkey";

  const card = document.createElement("div");
  card.className = "fw-pinned-card";

  // ── Privacy tier badge (absolute, top-right) ──────────
  const tierBadge = renderTierBadge(privacy.calendar);
  tierBadge.classList.add("fw-pinned-tier");
  card.appendChild(tierBadge);

  // ── Badge row ─────────────────────────────────────────
  const badge = document.createElement("div");
  badge.className = "fw-pinned-badge";

  const avatar = document.createElement("div");
  avatar.className = "fw-pinned-avatar";
  if (avatarUrl) {
    const img = document.createElement("img");
    img.src = avatarUrl;
    img.alt = "avatar";
    avatar.appendChild(img);
  } else {
    avatar.textContent = initial;
  }

  const nameEl = document.createElement("span");
  nameEl.className = "fw-pinned-name";
  nameEl.textContent = displayName;

  // Per-card month nav (only shown when calendar is visible)
  let cardYearMonth = yearMonth;

  const body = document.createElement("div");
  body.className = "fw-pinned-body";

  if (calFull) {
    // Month nav controls
    const prevBtn = document.createElement("button");
    prevBtn.className = "fw-pmn-btn";
    prevBtn.textContent = "\u2039";

    const monthLbl = document.createElement("span");
    monthLbl.className = "fw-pmn-lbl";
    monthLbl.textContent = shortMonthLabel(cardYearMonth);

    const nextBtn = document.createElement("button");
    nextBtn.className = "fw-pmn-btn";
    nextBtn.textContent = "\u203A";

    const nav = document.createElement("div");
    nav.className = "fw-pmn";
    nav.append(prevBtn, monthLbl, nextBtn);

    badge.append(avatar, nameEl, nav);

    // Helper: replace the card-level footer with fresh legend
    const refreshFooter = (entryLog) => {
      const old = card.querySelector(".fw-pinned-footer");
      if (old) old.remove();
      const newFooter = renderCalFooter(entryLog);
      if (newFooter) card.appendChild(newFooter);
    };

    // ── Mode 1: Calendar + Diary both full ─────────────
    if (diaryFull) {
      body.classList.add("fw-pinned-body--two-col");

      const calCol = document.createElement("div");
      calCol.className = "fw-pinned-cal-col";
      calCol.appendChild(renderMiniCal(log, cardYearMonth, true));

      const diaryCol = document.createElement("div");
      diaryCol.className = "fw-pinned-diary-col";
      diaryCol.appendChild(renderDiaryPanel(uid, yearMonth));

      body.append(calCol, diaryCol);

      const refreshCal = async (entryLog) => {
        calCol.innerHTML = "";
        calCol.appendChild(renderMiniCal(entryLog, cardYearMonth, true));
        refreshFooter(entryLog);
      };

      prevBtn.addEventListener("click", async () => {
        cardYearMonth = getPrevYearMonth(cardYearMonth);
        monthLbl.textContent = shortMonthLabel(cardYearMonth);
        if (cardYearMonth === yearMonth) {
          refreshCal(log);
        } else {
          const snap = await getDoc(doc(db, "logs", cardYearMonth, "entries", uid));
          const fetched = snap.exists() && snap.data().activities?.length
            ? { id: uid, ...snap.data(), displayName } : null;
          refreshCal(fetched);
        }
      });

      nextBtn.addEventListener("click", async () => {
        cardYearMonth = getNextYearMonth(cardYearMonth);
        monthLbl.textContent = shortMonthLabel(cardYearMonth);
        if (cardYearMonth === yearMonth) {
          refreshCal(log);
        } else {
          const snap = await getDoc(doc(db, "logs", cardYearMonth, "entries", uid));
          const fetched = snap.exists() && snap.data().activities?.length
            ? { id: uid, ...snap.data(), displayName } : null;
          refreshCal(fetched);
        }
      });

    } else {
      // ── Mode 2: Calendar full, diary signal ────────────
      // ── Mode 3: Calendar full, diary hidden ───────────
      body.appendChild(renderMiniCal(log, cardYearMonth, false));

      if (diarySignal) {
        const strip = document.createElement("div");
        strip.className = "fw-cal-signal-strip";
        strip.textContent = signal.headline;
        body.appendChild(strip);
      }

      const refreshCal = async (entryLog) => {
        const existing = body.querySelector(".fw-mini-cal");
        if (existing) existing.remove();
        body.insertBefore(renderMiniCal(entryLog, cardYearMonth, false), body.firstChild);
        refreshFooter(entryLog);
      };

      prevBtn.addEventListener("click", async () => {
        cardYearMonth = getPrevYearMonth(cardYearMonth);
        monthLbl.textContent = shortMonthLabel(cardYearMonth);
        if (cardYearMonth === yearMonth) {
          refreshCal(log);
        } else {
          const snap = await getDoc(doc(db, "logs", cardYearMonth, "entries", uid));
          const fetched = snap.exists() && snap.data().activities?.length
            ? { id: uid, ...snap.data(), displayName } : null;
          refreshCal(fetched);
        }
      });

      nextBtn.addEventListener("click", async () => {
        cardYearMonth = getNextYearMonth(cardYearMonth);
        monthLbl.textContent = shortMonthLabel(cardYearMonth);
        if (cardYearMonth === yearMonth) {
          refreshCal(log);
        } else {
          const snap = await getDoc(doc(db, "logs", cardYearMonth, "entries", uid));
          const fetched = snap.exists() && snap.data().activities?.length
            ? { id: uid, ...snap.data(), displayName } : null;
          refreshCal(fetched);
        }
      });
    }

  } else {
    // No month nav for non-calendar modes
    badge.append(avatar, nameEl);

    if (calSignal) {
      // ── Mode 4: Calendar signal (lowkey) ──────────────
      body.appendChild(renderSignalBlock(signal, diaryFull));
      if (diaryFull) {
        body.appendChild(renderDiaryPanel(uid, yearMonth));
      }

    } else if (diaryFull) {
      // ── Mode 5: Calendar hidden, diary full ───────────
      body.appendChild(renderDiaryPanel(uid, yearMonth));

    } else {
      // ── Mode 6/7: Both hidden ─────────────────────────
      const msg = document.createElement("p");
      msg.className = "fw-pinned-private";
      msg.textContent = "Tracking privately.";
      body.appendChild(msg);
    }
  }

  card.append(badge, body);
  if (calFull) {
    const footer = renderCalFooter(log);
    if (footer) card.appendChild(footer);
  }
  return card;
}

// ── Compact Row ────────────────────────────────────────

function renderCompactRow(uid, user, log, yearMonth, currentUser) {
  const displayName = user?.displayName || "Unknown";
  const initial     = displayName.charAt(0).toUpperCase();
  const avatarUrl   = user?.decoration?.avatarUrl;
  const privacy     = getPrivacy(user);
  const hasTracker  = !!log;
  const signal      = computeSignal(displayName, log);

  const wrap = document.createElement("div");
  wrap.className = "fw-compact-row-wrap";

  const row = document.createElement("div");
  row.className = "fw-compact-row";

  // Avatar
  const avatar = document.createElement("div");
  const trackerClass = hasTracker && privacy.calendar !== "ghost" ? "has-tracker" : "no-tracker";
  avatar.className = `fw-compact-avatar ${trackerClass}`;
  if (avatarUrl) {
    const img = document.createElement("img");
    img.src = avatarUrl;
    img.alt = "avatar";
    avatar.appendChild(img);
  } else {
    avatar.textContent = initial;
  }

  // Name + meta
  const info = document.createElement("div");
  info.className = "fw-compact-info";

  const name = document.createElement("div");
  name.className = "fw-compact-name";
  name.textContent = displayName;

  const meta = document.createElement("div");
  meta.className = "fw-compact-meta";
  if (!hasTracker) {
    meta.textContent = "No tracker this month";
  } else if (privacy.calendar === "ghost") {
    meta.textContent = "Tracking quietly";
  } else if (privacy.calendar === "lowkey") {
    meta.textContent = signal.headline;
  } else {
    const days = countUniqueDays(log);
    meta.textContent = `${days} check-in${days === 1 ? "" : "s"} this month`;
  }

  info.append(name, meta);

  // Right: tier badge + chevron
  const right = document.createElement("div");
  right.className = "fw-compact-right";
  right.appendChild(renderTierBadge(privacy.calendar));

  const chevron = document.createElement("span");
  chevron.className = "fw-compact-chevron";
  chevron.textContent = "\u203A";
  right.appendChild(chevron);

  row.append(avatar, info, right);

  // Inline expanded section
  const expanded = document.createElement("div");
  expanded.className = "fw-compact-expanded";
  expanded.hidden = true;

  let built = false;
  row.addEventListener("click", () => {
    const isOpen = !expanded.hidden;
    expanded.hidden = isOpen;
    expanded.classList.toggle("open", !isOpen);
    chevron.classList.toggle("open", !isOpen);
    if (!isOpen && !built) {
      built = true;
      expanded.appendChild(renderPinnedCard(uid, user, log, yearMonth, currentUser));
    }
  });

  wrap.append(row, expanded);
  return wrap;
}

// ── Section Label ──────────────────────────────────────

function renderSectionLbl(text, count) {
  const lbl = document.createElement("div");
  lbl.className = "fw-section-lbl";

  const t = document.createElement("span");
  t.textContent = text;
  lbl.appendChild(t);

  if (count !== undefined) {
    const badge = document.createElement("span");
    badge.className = "fw-section-count";
    badge.textContent = count;
    lbl.appendChild(badge);
  }

  return lbl;
}

// ── Main export ────────────────────────────────────────

export function renderPeopleView(container, model) {
  const {
    currentUser, yearMonth, followingIds, pinnedFollowingIds,
    logsCache, userCache, onSwitchToAll,
  } = model;

  container.innerHTML = "";

  const pinnedSet = new Set(pinnedFollowingIds);
  const items = followingIds.map(uid => ({
    uid,
    user:     userCache[uid] || null,
    log:      Object.prototype.hasOwnProperty.call(logsCache, uid) ? logsCache[uid] : undefined,
    isPinned: pinnedSet.has(uid),
  }));

  const pinnedActive   = items.filter(i => i.log  && i.isPinned);
  const activeUnpinned = items.filter(i => i.log  && !i.isPinned);
  const crickets       = items.filter(i => i.log === null);
  const allEmpty       = items.length === 0;

  const layout = document.createElement("div");
  layout.className = "fw-people-layout";

  // ── Left column ───────────────────────────────────────
  const main = document.createElement("div");
  main.className = "fw-people-main";

  if (allEmpty) {
    main.appendChild(renderBrowseNudge(onSwitchToAll));
  } else {
    if (pinnedActive.length > 0) {
      main.appendChild(renderSectionLbl("\uD83D\uDCCC Pinned"));
      for (const { uid, user, log } of pinnedActive) {
        main.appendChild(renderPinnedCard(uid, user, log, yearMonth, currentUser));
      }
    }

    main.appendChild(renderSectionLbl("Showing Up", activeUnpinned.length));
    if (activeUnpinned.length === 0) {
      const empty = document.createElement("p");
      empty.className = "fw-section-empty";
      empty.textContent = "No one else showing up this month.";
      main.appendChild(empty);
    } else {
      for (const { uid, user, log } of activeUnpinned) {
        main.appendChild(renderCompactRow(uid, user, log, yearMonth, currentUser));
      }
    }

    main.appendChild(renderSectionLbl("Crickets... \uD83E\uDD97", crickets.length));
    if (crickets.length === 0) {
      const empty = document.createElement("p");
      empty.className = "fw-section-empty";
      empty.textContent = "Everyone\u2019s showing up!";
      main.appendChild(empty);
    } else {
      for (const { uid, user } of crickets) {
        main.appendChild(renderCompactRow(uid, user, null, yearMonth, currentUser));
      }
    }
  }

  // ── Right column (hidden on mobile via CSS) ───────────
  const side = document.createElement("div");
  side.className = "fw-people-side";
  side.appendChild(renderBrowseNudge(onSwitchToAll));

  layout.append(main, side);
  container.appendChild(layout);
}
