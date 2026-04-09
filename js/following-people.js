import { computeSignal } from "./following-signals.js";
import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, arrayRemove, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
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

function formatDocId(docId) {
  const [year, month, day] = docId.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleString("en-US", {
    month: "short", day: "numeric"
  });
}

// ── Diary Strip (synchronous -- entry already fetched and cached) ──

function renderDiaryStrip(entry, privacy, signal) {
  if (privacy.diary === "ghost" || privacy.diary === "private") return null;

  const strip = document.createElement("div");
  strip.className = "fw-diary-strip";

  if (privacy.diary === "lowkey") {
    const lbl = document.createElement("span");
    lbl.className = "fw-diary-strip-label";
    lbl.textContent = "diary.";
    const sig = document.createElement("span");
    sig.className = "fw-diary-strip-signal";
    sig.textContent = signal.diaryHeadline;
    strip.append(lbl, sig);
    return strip;
  }

  // sharing or followers -- entry is already resolved, no async needed
  if (!entry?.note) return null;

  const header = document.createElement("div");
  header.className = "fw-diary-strip-header";
  const lbl = document.createElement("span");
  lbl.className = "fw-diary-strip-label";
  lbl.textContent = "diary.";
  const date = document.createElement("span");
  date.className = "fw-diary-strip-date";
  date.textContent = formatDocId(entry.docId);
  header.append(lbl, date);

  const body = document.createElement("div");
  body.className = "fw-diary-strip-body";
  const note = document.createElement("div");
  note.className = "fw-diary-strip-note";
  note.textContent = entry.note;
  body.appendChild(note);

  if (entry.photoUrl) {
    const photo = document.createElement("img");
    photo.className = "fw-diary-strip-photo";
    photo.src = entry.photoUrl;
    photo.alt = "";
    body.appendChild(photo);
  }

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
  return strip;
}

// ── Browse Nudge Card ────────────────────────────────────

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

// ── Pinned Card ──────────────────────────────────────────

function renderPinnedCard(uid, user, log, yearMonth, currentUser, pinnedFollowingIds, diaryEntry) {
  const displayName = user?.displayName || "Unknown";
  const privacy     = getPrivacy(user);
  const signal      = computeSignal(displayName, log);

  let cardYearMonth = yearMonth;

  const buildEntry = (entryLog) => {
    if (entryLog) return entryLog;
    return {
      id: uid,
      displayName,
      decoration: user?.decoration || { color: "#D8584E", fontColor: "#FFFFFF", font: "Inter", sticker: "", marker: "circle", avatarUrl: "" },
      marks: {},
      activities: [],
    };
  };

  // ── Month nav
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

  // ── Actions btn + popover
  const actionsBtn = document.createElement("button");
  actionsBtn.className = "fw-pmn-actions-btn";
  actionsBtn.textContent = "\u00B7\u00B7\u00B7";
  let popover = null;
  let dismissHandler = null;
  const closePopover = () => {
    if (!popover) return;
    popover.remove(); popover = null;
    if (dismissHandler) { document.removeEventListener("click", dismissHandler); dismissHandler = null; }
  };
  actionsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (popover) { closePopover(); return; }
    popover = document.createElement("div");
    popover.className = "fw-pmn-popover";
    const unfollowBtn = document.createElement("button");
    unfollowBtn.className = "unfollow";
    unfollowBtn.textContent = "Unfollow";
    unfollowBtn.addEventListener("click", async (e) => {
      e.stopPropagation(); closePopover();
      try {
        await setDoc(doc(db, "users", currentUser.uid),
          { following: arrayRemove(uid), pinnedFollowing: arrayRemove(uid) }, { merge: true });
        showToast(`Unfollowed ${displayName}.`);
      } catch { showToast("Couldn't unfollow. Try again.", "error"); }
    });
    popover.appendChild(unfollowBtn);
    actionsBtn.parentElement.appendChild(popover);
    dismissHandler = (ev) => {
      if (!popover?.contains(ev.target) && ev.target !== actionsBtn) closePopover();
    };
    setTimeout(() => { if (popover) document.addEventListener("click", dismissHandler); }, 0);
  });

  // ── Pin button (unpin action) -- lives in the badge row, rightmost
  const pinBtn = document.createElement("button");
  pinBtn.className = "fw-pin-btn fw-pin-btn--pinned";
  pinBtn.textContent = "📌";
  pinBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await setDoc(doc(db, "users", currentUser.uid), { pinnedFollowing: arrayRemove(uid) }, { merge: true });
      showToast("Unpinned.");
    } catch { showToast("Couldn't unpin. Try again.", "error"); }
  });

  const attachControls = (badge) => { badge.append(nav, actionsBtn); };

  // ── Diary strip (synchronous, uses cached entry)
  const diaryStrip = renderDiaryStrip(diaryEntry, privacy, signal);

  // ── Slot
  const slot = document.createElement("div");
  slot.className = "fw-pinned-slot";
  const inner = document.createElement("div");
  inner.className = "fw-pinned-slot-inner";

  if (privacy.calendar === "ghost") {
    inner.classList.add("fw-ghost-card");

    // ── Ghost header bar (actions only, no month nav)
    const deco = user?.decoration || { color: "#D8584E", fontColor: "#FFFFFF" };
    const header = document.createElement("div");
    header.className = "fw-lowkey-header";
    header.style.background = deco.color;
    header.style.color = deco.fontColor || "#FFFFFF";
    const nameEl = document.createElement("span");
    nameEl.className = "fw-lowkey-header-name";
    nameEl.textContent = displayName;
    header.append(nameEl, actionsBtn);
    inner.appendChild(header);

    // ── Ghost quiet zone
    const zone = document.createElement("div");
    zone.className = "fw-ghost-quiet-zone";
    const icon = document.createElement("div");
    icon.className = "fw-ghost-icon";
    icon.textContent = "\uD83C\uDF19";
    const text = document.createElement("div");
    text.className = "fw-ghost-quiet-text";
    text.textContent = "Gone quiet for now.";
    zone.append(icon, text);
    inner.appendChild(zone);
  } else if (privacy.calendar === "lowkey") {
    // ── Lowkey header bar (mirrors cal-card-badge visually)
    const deco = user?.decoration || { color: "#D8584E", fontColor: "#FFFFFF" };
    const header = document.createElement("div");
    header.className = "fw-lowkey-header";
    header.style.background = deco.color;
    header.style.color = deco.fontColor || "#FFFFFF";
    const nameEl = document.createElement("span");
    nameEl.className = "fw-lowkey-header-name";
    nameEl.textContent = displayName;
    header.append(nameEl, nav, actionsBtn);
    inner.appendChild(header);

    // ── Signal block
    const signalBlock = document.createElement("div");
    signalBlock.className = "fw-signal-block" + (diaryStrip ? " fw-signal-block--with-diary" : "");
    const headlineEl = document.createElement("div");
    headlineEl.className = "fw-signal-headline";
    headlineEl.textContent = signal.calendarHeadline;
    const whisper = document.createElement("div");
    whisper.className = "fw-lowkey-whisper";
    whisper.textContent = "low key";
    signalBlock.append(headlineEl, whisper);
    inner.appendChild(signalBlock);
  } else {
    // ── Sharing / Followers: full calendar card
    let calCard = renderMobileCard(buildEntry(log), cardYearMonth, currentUser, { isFollowing: true, showFollowBtn: false });
    attachControls(calCard.querySelector(".cal-card-badge"));
    inner.appendChild(calCard);

    // ── Month nav refresh (only replaces cal card, diary strip stays)
    const refreshCard = async (newLog, newYearMonth) => {
      closePopover();
      const newCalCard = renderMobileCard(buildEntry(newLog), newYearMonth, currentUser, { isFollowing: true, showFollowBtn: false });
      attachControls(newCalCard.querySelector(".cal-card-badge"));
      calCard.replaceWith(newCalCard);
      calCard = newCalCard;
      if (diaryStrip && inner.contains(diaryStrip)) inner.appendChild(diaryStrip);
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
  }

  if (privacy.calendar !== "ghost" && diaryStrip) inner.appendChild(diaryStrip);
  slot.appendChild(inner);
  if (pinnedFollowingIds?.includes(uid)) slot.appendChild(pinBtn);

  return slot;
}

// ── Compact Row ──────────────────────────────────────────

function renderCompactRow(uid, user, log, yearMonth, currentUser, pinnedFollowingIds, diaryEntry) {
  const displayName = user?.displayName || "Unknown";
  const initial     = displayName.charAt(0).toUpperCase();
  const avatarUrl   = log?.decoration?.avatarUrl || user?.decoration?.avatarUrl;
  const privacy     = getPrivacy(user);
  const hasTracker  = !!log;
  const signal      = computeSignal(displayName, log);

  const isGhost = privacy.calendar === "ghost";

  const wrap = document.createElement("div");
  wrap.className = "fw-compact-row-wrap";
  const row = document.createElement("div");
  row.className = isGhost ? "fw-compact-row fw-ghost-compact" : "fw-compact-row";

  const avatar = document.createElement("div");
  const trackerClass = hasTracker && !isGhost ? "has-tracker" : "no-tracker";
  avatar.className = `fw-compact-avatar ${trackerClass}`;
  if (avatarUrl) {
    const img = document.createElement("img"); img.src = avatarUrl; img.alt = "avatar";
    avatar.appendChild(img);
  } else { avatar.textContent = initial; }

  const info = document.createElement("div"); info.className = "fw-compact-info";
  const name = document.createElement("div");
  name.className = isGhost ? "fw-compact-name fw-ghost-name" : "fw-compact-name";
  name.textContent = displayName;
  const meta = document.createElement("div"); meta.className = "fw-compact-meta";
  if (!hasTracker)                        meta.textContent = "No tracker this month";
  else if (isGhost)                       meta.textContent = "Gone quiet for now.";
  else if (privacy.calendar === "lowkey") meta.textContent = signal.calendarHeadline;
  else { const days = countUniqueDays(log); meta.textContent = `${days} check-in${days === 1 ? "" : "s"} this month`; }
  info.append(name, meta);

  const right = document.createElement("div"); right.className = "fw-compact-right";
  if (!isGhost) right.appendChild(renderTierBadge(privacy.calendar));
  const compactPinBtn = document.createElement("button");
  compactPinBtn.className = "fw-pin-btn fw-pin-btn--unpinned";
  compactPinBtn.textContent = "\uD83D\uDCCC";
  compactPinBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await setDoc(doc(db, "users", currentUser.uid), { pinnedFollowing: arrayUnion(uid) }, { merge: true });
      showToast("Pinned!");
    } catch { showToast("Couldn't pin. Try again.", "error"); }
  });
  right.appendChild(compactPinBtn);
  const chevron = document.createElement("span"); chevron.className = "fw-compact-chevron"; chevron.textContent = "\u203A";
  right.appendChild(chevron);
  row.append(avatar, info, right);

  const expanded = document.createElement("div"); expanded.className = "fw-compact-expanded"; expanded.hidden = true;
  let built = false;
  row.addEventListener("click", () => {
    const isOpen = !expanded.hidden;
    expanded.hidden = isOpen;
    expanded.classList.toggle("open", !isOpen);
    chevron.classList.toggle("open", !isOpen);
    if (!isOpen && !built) {
      built = true;
      expanded.appendChild(renderPinnedCard(uid, user, log, yearMonth, currentUser, pinnedFollowingIds, diaryEntry));
    }
  });

  wrap.append(row, expanded);
  return wrap;
}

// ── Section Label ──────────────────────────────────────────

function renderSectionLbl(text, count) {
  const lbl = document.createElement("div"); lbl.className = "fw-section-lbl";
  const t = document.createElement("span"); t.textContent = text; lbl.appendChild(t);
  if (count !== undefined) {
    const badge = document.createElement("span"); badge.className = "fw-section-count"; badge.textContent = count;
    lbl.appendChild(badge);
  }
  return lbl;
}

// ── Main export ──────────────────────────────────────────

export function renderPeopleView(container, model) {
  const {
    currentUser, yearMonth, followingIds, pinnedFollowingIds,
    logsCache, userCache, diaryCache, onSwitchToAll,
  } = model;

  container.innerHTML = "";

  const pinnedSet = new Set(pinnedFollowingIds);
  const items = followingIds.map(uid => ({
    uid,
    user:       userCache[uid] || null,
    log:        Object.prototype.hasOwnProperty.call(logsCache, uid) ? logsCache[uid] : undefined,
    diaryEntry: diaryCache?.[uid] ?? null,
    isPinned:   pinnedSet.has(uid),
  }));

  const pinnedActive   = items.filter(i => i.log  && i.isPinned);
  const activeUnpinned = items.filter(i => i.log  && !i.isPinned);
  const crickets       = items.filter(i => i.log === null);
  const allEmpty       = items.length === 0;

  const layout = document.createElement("div"); layout.className = "fw-people-layout";
  const main   = document.createElement("div"); main.className = "fw-people-main";

  const side = document.createElement("div"); side.className = "fw-people-side";

  if (allEmpty) {
    main.appendChild(renderBrowseNudge(onSwitchToAll));
  } else {
    if (pinnedActive.length > 0) {
      main.appendChild(renderSectionLbl("\uD83D\uDCCC Pinned"));
      for (const { uid, user, log, diaryEntry } of pinnedActive) {
        main.appendChild(renderPinnedCard(uid, user, log, yearMonth, currentUser, pinnedFollowingIds, diaryEntry));
      }
    }

    side.appendChild(renderSectionLbl("Showing Up", activeUnpinned.length));
    if (activeUnpinned.length === 0) {
      const empty = document.createElement("p"); empty.className = "fw-section-empty";
      empty.textContent = "No one else showing up this month.";
      side.appendChild(empty);
    } else {
      for (const { uid, user, log, diaryEntry } of activeUnpinned) {
        side.appendChild(renderCompactRow(uid, user, log, yearMonth, currentUser, pinnedFollowingIds, diaryEntry));
      }
    }

    side.appendChild(renderSectionLbl("Crickets... \uD83E\uDD97", crickets.length));
    if (crickets.length === 0) {
      const empty = document.createElement("p"); empty.className = "fw-section-empty";
      empty.textContent = "Everyone\u2019s showing up!";
      side.appendChild(empty);
    } else {
      for (const { uid, user, diaryEntry } of crickets) {
        side.appendChild(renderCompactRow(uid, user, null, yearMonth, currentUser, pinnedFollowingIds, diaryEntry));
      }
    }

    side.appendChild(renderBrowseNudge(onSwitchToAll));
  }

  layout.append(main, side);
  container.appendChild(layout);
}
