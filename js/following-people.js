import { computeSignal } from "./following-signals.js";
import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, arrayRemove, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getDiaryEntry } from "./diary.js";
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
  // docId is like "2026-04-05" -> "April 5, 2026"
  const [year, month, day] = docId.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric"
  });
}

// ── Fetch most recent diary entry across ALL months ─────────

async function fetchLatestDiaryEntry(uid) {
  // Fetch all entry doc IDs (format: YYYY-MM-DD), sort descending, get the latest with a note.
  const snap = await getDocs(collection(db, "diary", uid, "entries"));
  if (snap.empty) return null;

  // Sort doc IDs descending (lexicographic sort works for YYYY-MM-DD)
  const sortedDocs = snap.docs
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.id))
    .sort((a, b) => b.id.localeCompare(a.id));

  for (const d of sortedDocs) {
    const data = d.data();
    if (data.note) return { docId: d.id, ...data };
  }
  return null;
}

// ── Diary Strip ─────────────────────────────────────────

function renderDiaryStrip(uid, privacy, signal) {
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

  // "sharing" or "followers" -- full strip with async fetch
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
      const entry = await fetchLatestDiaryEntry(uid);
      if (!entry?.note) { strip.remove(); return; }
      note.textContent = entry.note;
      date.textContent = formatDocId(entry.docId);
      if (entry.photoUrl) {
        const photo = document.createElement("img");
        photo.className = "fw-diary-strip-photo";
        photo.src = entry.photoUrl;
        photo.alt = "";
        body.appendChild(photo);
      }
    } catch {
      strip.remove();
    }
  })();

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

function renderPinnedCard(uid, user, log, yearMonth, currentUser, pinnedFollowingIds) {
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
    popover.remove();
    popover = null;
    if (dismissHandler) { document.removeEventListener("click", dismissHandler); dismissHandler = null; }
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
        e.stopPropagation(); closePopover();
        try {
          await setDoc(doc(db, "users", currentUser.uid), { pinnedFollowing: arrayRemove(uid) }, { merge: true });
          showToast("Unpinned.");
        } catch { showToast("Couldn't unpin. Try again.", "error"); }
      });
      popover.appendChild(unpinBtn);
    }

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

  const attachControls = (badge) => { badge.append(nav, actionsBtn); };

  // ── Cal card
  let calCard = renderMobileCard(buildEntry(log), cardYearMonth, currentUser, { isFollowing: true, showFollowBtn: false });
  attachControls(calCard.querySelector(".cal-card-badge"));

  // ── Diary strip (always fetches latest across all months)
  let diaryStrip = renderDiaryStrip(uid, privacy, signal);

  // ── Slot
  const slot = document.createElement("div");
  slot.className = "fw-pinned-slot";
  slot.appendChild(calCard);
  if (diaryStrip) slot.appendChild(diaryStrip);

  // ── Month nav refresh (only replaces cal card, diary strip stays)
  const refreshCard = async (newLog, newYearMonth) => {
    closePopover();
    const newCalCard = renderMobileCard(buildEntry(newLog), newYearMonth, currentUser, { isFollowing: true, showFollowBtn: false });
    attachControls(newCalCard.querySelector(".cal-card-badge"));
    calCard.replaceWith(newCalCard);
    calCard = newCalCard;
    // Move diary strip to end after new cal card
    if (diaryStrip && slot.contains(diaryStrip)) slot.appendChild(diaryStrip);
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

// ── Compact Row ──────────────────────────────────────────

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

  const avatar = document.createElement("div");
  const trackerClass = hasTracker && privacy.calendar !== "ghost" ? "has-tracker" : "no-tracker";
  avatar.className = `fw-compact-avatar ${trackerClass}`;
  if (avatarUrl) {
    const img = document.createElement("img");
    img.src = avatarUrl; img.alt = "avatar";
    avatar.appendChild(img);
  } else {
    avatar.textContent = initial;
  }

  const info = document.createElement("div");
  info.className = "fw-compact-info";
  const name = document.createElement("div");
  name.className = "fw-compact-name";
  name.textContent = displayName;
  const meta = document.createElement("div");
  meta.className = "fw-compact-meta";
  if (!hasTracker)                       meta.textContent = "No tracker this month";
  else if (privacy.calendar === "ghost") meta.textContent = "Tracking quietly";
  else if (privacy.calendar === "lowkey") meta.textContent = signal.headline;
  else {
    const days = countUniqueDays(log);
    meta.textContent = `${days} check-in${days === 1 ? "" : "s"} this month`;
  }
  info.append(name, meta);

  const right = document.createElement("div");
  right.className = "fw-compact-right";
  right.appendChild(renderTierBadge(privacy.calendar));
  const chevron = document.createElement("span");
  chevron.className = "fw-compact-chevron";
  chevron.textContent = "\u203A";
  right.appendChild(chevron);

  row.append(avatar, info, right);

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

// ── Section Label ──────────────────────────────────────────

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

// ── Main export ──────────────────────────────────────────

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

  const side = document.createElement("div");
  side.className = "fw-people-side";
  side.appendChild(renderBrowseNudge(onSwitchToAll));

  layout.append(main, side);
  container.appendChild(layout);
}
