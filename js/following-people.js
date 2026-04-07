import { computeSignal } from "./following-signals.js";
import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, arrayRemove, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getDiaryDays, getDiaryEntry } from "./diary.js";
import { getPrevYearMonth, getNextYearMonth } from "./utils.js";
import { renderMobileCard } from "./mobile-tracker.js";
import { showToast } from "./ui.js";

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

// ── Diary Strip ───────────────────────────────────────

function renderDiaryStrip(uid, yearMonth, privacy, signal) {
  if (privacy.diary === "ghost" || privacy.diary === "private") return null;

  const strip = document.createElement("div");
  strip.className = "fw-diary-strip";

  if (privacy.diary === "lowkey") {
    const lbl = document.createElement("span");
    lbl.className = "fw-diary-strip-label";
    lbl.textContent = "diary.";

    const sig = document.createElement("span");
    sig.className = "fw-diary-strip-signal";
    sig.textContent = signal.headline;

    strip.append(lbl, sig);
    return strip;
  }

  // "sharing" or "followers" — full strip
  const header = document.createElement("div");
  header.className = "fw-diary-strip-header";

  const lbl = document.createElement("span");
  lbl.className = "fw-diary-strip-label";
  lbl.textContent = "diary.";

  const date = document.createElement("span");
  date.className = "fw-diary-strip-date";

  header.append(lbl, date);

  const body = document.createElement("div");
  body.className = "fw-diary-strip-body";

  const note = document.createElement("div");
  note.className = "fw-diary-strip-note";

  body.appendChild(note);

  const footer = document.createElement("div");
  footer.className = "fw-diary-strip-footer";

  const viewBtn = document.createElement("button");
  viewBtn.className = "fw-diary-view-btn";
  viewBtn.textContent = "view full diary \u2192";
  viewBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showToast("Coming soon!");
  });

  footer.appendChild(viewBtn);
  strip.append(header, body, footer);

  (async () => {
    try {
      const days = await getDiaryDays(uid, yearMonth);
      if (days.size === 0) { strip.remove(); return; }
      const latestDay = Math.max(...days);
      const entry = await getDiaryEntry(uid, yearMonth, latestDay);
      if (entry?.note) {
        note.textContent = entry.note;
        date.textContent = formatDay(yearMonth, latestDay);
        if (entry.photoUrl) {
          const photo = document.createElement("img");
          photo.className = "fw-diary-strip-photo";
          photo.src = entry.photoUrl;
          photo.alt = "";
          photo.width = 44;
          photo.height = 44;
          body.appendChild(photo);
        }
      } else {
        strip.remove();
      }
    } catch {
      strip.remove();
    }
  })();

  return strip;
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

function renderPinnedCard(uid, user, log, yearMonth, currentUser, pinnedFollowingIds) {
  const displayName = user?.displayName || "Unknown";
  const privacy     = getPrivacy(user);
  const signal      = computeSignal(displayName, log);

  let cardYearMonth = yearMonth;

  // ── Build a safe entry for renderMobileCard ────────────
  const buildEntry = (entryLog) => {
    if (entryLog) return entryLog;
    return {
      id: uid,
      displayName,
      decoration: user?.decoration || { color: "#FF6B6B", fontColor: "#FFFFFF", font: "Inter", sticker: "sunflower2", marker: "square", avatarUrl: "" },
      marks: {},
      activities: [],
    };
  };

  // ── Month nav ──────────────────────────────────────────
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

  // ── Actions button + popover ───────────────────────────
  const actionsBtn = document.createElement("button");
  actionsBtn.className = "fw-pmn-actions-btn";
  actionsBtn.textContent = "\u00B7\u00B7\u00B7";

  let popover = null;
  let dismissHandler = null;

  const closePopover = () => {
    if (!popover) return;
    popover.remove();
    popover = null;
    if (dismissHandler) {
      document.removeEventListener("click", dismissHandler);
      dismissHandler = null;
    }
  };

  actionsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (popover) { closePopover(); return; }

    popover = document.createElement("div");
    popover.className = "fw-pmn-popover";

    if (pinnedFollowingIds?.includes(uid)) {
      const unpinBtn = document.createElement("button");
      unpinBtn.textContent = "Unpin";
      unpinBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        closePopover();
        try {
          await setDoc(doc(db, "users", currentUser.uid),
            { pinnedFollowing: arrayRemove(uid) }, { merge: true });
          showToast("Unpinned.");
        } catch {
          showToast("Couldn't unpin. Try again.", "error");
        }
      });
      popover.appendChild(unpinBtn);
    }

    const unfollowBtn = document.createElement("button");
    unfollowBtn.className = "unfollow";
    unfollowBtn.textContent = "Unfollow";
    unfollowBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      closePopover();
      try {
        await setDoc(doc(db, "users", currentUser.uid),
          { following: arrayRemove(uid), pinnedFollowing: arrayRemove(uid) }, { merge: true });
        showToast(`Unfollowed ${displayName}.`);
      } catch {
        showToast("Couldn't unfollow. Try again.", "error");
      }
    });
    popover.appendChild(unfollowBtn);

    actionsBtn.parentElement.appendChild(popover);

    dismissHandler = (ev) => {
      if (!popover?.contains(ev.target) && ev.target !== actionsBtn) {
        closePopover();
      }
    };
    setTimeout(() => {
      if (popover) document.addEventListener("click", dismissHandler);
    }, 0);
  });

  // ── Helper: attach nav+actions to a badge ──────────────
  const attachControls = (badge) => {
    badge.append(nav, actionsBtn);
  };

  // ── Initial cal card ───────────────────────────────────
  let calCard = renderMobileCard(buildEntry(log), cardYearMonth, currentUser, { isFollowing: true, showFollowBtn: false });
  attachControls(calCard.querySelector(".cal-card-badge"));

  // ── Diary strip ────────────────────────────────────────
  let diaryStrip = renderDiaryStrip(uid, yearMonth, privacy, signal);

  // ── Slot: stable parent for refresh logic ──────────────
  const slot = document.createElement("div");
  slot.className = "fw-pinned-slot";
  slot.appendChild(calCard);
  if (diaryStrip) slot.appendChild(diaryStrip);

  // ── Month nav refresh ──────────────────────────────────
  const refreshCard = async (newLog, newYearMonth) => {
    closePopover();
    const newCalCard = renderMobileCard(buildEntry(newLog), newYearMonth, currentUser, { isFollowing: true, showFollowBtn: false });
    attachControls(newCalCard.querySelector(".cal-card-badge"));
    calCard.replaceWith(newCalCard);
    calCard = newCalCard;

    const newDiaryStrip = renderDiaryStrip(uid, newYearMonth, privacy, signal);
    if (diaryStrip) diaryStrip.remove();
    if (newDiaryStrip) slot.appendChild(newDiaryStrip);
    diaryStrip = newDiaryStrip;
  };

  prevBtn.addEventListener("click", async () => {
    cardYearMonth = getPrevYearMonth(cardYearMonth);
    monthLbl.textContent = shortMonthLabel(cardYearMonth);
    if (cardYearMonth === yearMonth) {
      await refreshCard(log, cardYearMonth);
    } else {
      const snap = await getDoc(doc(db, "logs", cardYearMonth, "entries", uid));
      const fetched = snap.exists() && snap.data().activities?.length
        ? { id: uid, ...snap.data(), displayName } : null;
      await refreshCard(fetched, cardYearMonth);
    }
  });

  nextBtn.addEventListener("click", async () => {
    cardYearMonth = getNextYearMonth(cardYearMonth);
    monthLbl.textContent = shortMonthLabel(cardYearMonth);
    if (cardYearMonth === yearMonth) {
      await refreshCard(log, cardYearMonth);
    } else {
      const snap = await getDoc(doc(db, "logs", cardYearMonth, "entries", uid));
      const fetched = snap.exists() && snap.data().activities?.length
        ? { id: uid, ...snap.data(), displayName } : null;
      await refreshCard(fetched, cardYearMonth);
    }
  });

  return slot;
}

// ── Compact Row ────────────────────────────────────────

function renderCompactRow(uid, user, log, yearMonth, currentUser, pinnedFollowingIds) {
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
      expanded.appendChild(renderPinnedCard(uid, user, log, yearMonth, currentUser, pinnedFollowingIds));
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
        main.appendChild(renderPinnedCard(uid, user, log, yearMonth, currentUser, pinnedFollowingIds));
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
        main.appendChild(renderCompactRow(uid, user, log, yearMonth, currentUser, pinnedFollowingIds));
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
        main.appendChild(renderCompactRow(uid, user, null, yearMonth, currentUser, pinnedFollowingIds));
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
