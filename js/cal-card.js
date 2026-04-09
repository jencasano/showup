import { db } from "./firebase-config.js";
import { getDiaryDays, getDiaryEntry } from "./diary.js";
import {
  doc, getDoc, setDoc, updateDoc,
  arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getDaysInMonth, getCurrentYearMonth, getActivityColor, getPrevYearMonth, getNextYearMonth } from "./utils.js";
import { openManageActivitiesModal } from "./manage-activities.js";
import { showToast } from "./ui.js";
import { icon, STICKER_ICONS } from "./icons.js";
import { openDiaryPage } from "./diary-mobile.js";

const MARKER_SYMBOLS = {
  square:   "\u25a0",
  circle:   "\u25cf",
  star:     "\u2605",
  heart:    "\u2665",
  check:    "\u2713",
  x:        "\u2717",
  scribble: "\u3030"
};

const MAX_VISIBLE_DOTS = 5;

function renderSticker(sticker) {
  if (STICKER_ICONS.includes(sticker)) {
    return icon(sticker, 18, "cal-card-sticker-icon");
  }
  return sticker || "";
}

// ─── RENDER MOBILE CALENDAR CARD ────────────────────
export function renderMobileCard(entry, yearMonth, currentUser, opts = {}) {
  const { isFollowing = false, showFollowBtn = false, onMarkToggled = null, showMonthNav = false } = opts;
  const isOwner = currentUser && currentUser.uid === entry.id;
  let cardYearMonth = yearMonth;
  let isCurrentMonth = cardYearMonth === getCurrentYearMonth();
  const todayDate = new Date().getDate();
  const { color, fontColor, font, sticker, marker, avatarUrl } = entry.decoration;

  let activeFilter = null;
  let following = isFollowing;
  let followLoading = false;

  const card = document.createElement("div");
  card.className = "cal-card";
  card.style.borderColor = color;

  // ── Badge / Header ──────────────────────────────────
  const badge = document.createElement("div");
  badge.className = "cal-card-badge";
  badge.style.background = color;
  badge.style.color = fontColor;
  badge.style.fontFamily = `'${font}', sans-serif`;

  const avatarEl = document.createElement("div");
  avatarEl.className = "cal-card-avatar-wrap";
  if (avatarUrl) {
    avatarEl.innerHTML = `<img src="${avatarUrl}" class="cal-card-avatar" alt="avatar" />`;
  } else {
    const initials = (entry.displayName || "?").charAt(0).toUpperCase();
    avatarEl.innerHTML = `<div class="cal-card-avatar-initials">${initials}</div>`;
  }

  const nameWrap = document.createElement("div");
  nameWrap.className = "cal-card-name-wrap";
  nameWrap.innerHTML = `
    <span class="cal-card-name" title="${entry.displayName}">${entry.displayName}</span>
    <span class="cal-card-sticker">${renderSticker(sticker)}</span>
  `;

  badge.appendChild(avatarEl);
  badge.appendChild(nameWrap);

  // ── Per-card month nav ──────────────────────────────
  if (showMonthNav && !isOwner) {
    const nav = document.createElement("div");
    nav.className = "cal-pmn";

    const prevBtn = document.createElement("button");
    prevBtn.className = "cal-pmn-btn";
    prevBtn.textContent = "\u2039";

    const monthLbl = document.createElement("span");
    monthLbl.className = "cal-pmn-lbl";
    const shortLabel = (ym) => {
      const [y, m] = ym.split("-").map(Number);
      return new Date(y, m - 1).toLocaleString("en", { month: "short" });
    };
    monthLbl.textContent = shortLabel(cardYearMonth);

    const nextBtn = document.createElement("button");
    nextBtn.className = "cal-pmn-btn";
    nextBtn.textContent = "\u203a";

    const navigateMonth = async (newYM) => {
      cardYearMonth = newYM;
      isCurrentMonth = cardYearMonth === getCurrentYearMonth();
      monthLbl.textContent = shortLabel(cardYearMonth);

      if (cardYearMonth === yearMonth) {
        render();
        return;
      }

      const snap = await getDoc(doc(db, "logs", cardYearMonth, "entries", entry.id));
      if (snap.exists() && snap.data().activities?.length) {
        const data = snap.data();
        entry.marks = data.marks || {};
        entry.activities = data.activities;
        render();
      } else {
        calBody.innerHTML = `<p style="text-align:center;color:var(--text-faint);font-size:0.85rem;padding:24px 0;">Nothing logged for this month.</p>`;
        footer.innerHTML = "";
        filterBar.style.display = "none";
        filterBar.innerHTML = "";
      }
    };

    prevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      navigateMonth(getPrevYearMonth(cardYearMonth));
    });

    nextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      navigateMonth(getNextYearMonth(cardYearMonth));
    });

    nav.append(prevBtn, monthLbl, nextBtn);
    badge.appendChild(nav);
  }

  // ── Follow / Unfollow button ────────────────────────
  if (showFollowBtn && !isOwner && currentUser) {
    const followBtn = document.createElement("button");
    followBtn.className = `cal-follow-btn ${following ? "following" : ""}`;
    followBtn.style.marginLeft = "auto";
    followBtn.innerHTML = following
      ? `<span class="follow-btn-check">\u2713</span> Following`
      : `<span class="follow-btn-plus">+</span> Follow`;

    followBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (followLoading) return;
      followLoading = true;
      followBtn.disabled = true;
      followBtn.classList.add("loading");
      try {
        const myRef = doc(db, "users", currentUser.uid);
        if (following) {
          await setDoc(myRef, {
            following: arrayRemove(entry.id),
            pinnedFollowing: arrayRemove(entry.id)
          }, { merge: true });
          following = false;
          followBtn.innerHTML = `<span class="follow-btn-plus">+</span> Follow`;
          followBtn.classList.remove("following");
        } else {
          await setDoc(myRef, { following: arrayUnion(entry.id) }, { merge: true });
          following = true;
          followBtn.innerHTML = `<span class="follow-btn-check">\u2713</span> Following`;
          followBtn.classList.add("following");
        }
      } catch (err) {
        console.error("Follow error:", err);
        showToast("Couldn't update follow. Try again.", "error");
      } finally {
        followLoading = false;
        followBtn.disabled = false;
        followBtn.classList.remove("loading");
      }
    });
    badge.appendChild(followBtn);
  }

  if (isOwner) {
    const youPill = document.createElement("span");
    youPill.className = "cal-you-pill";
    youPill.textContent = "you";
    badge.appendChild(youPill);
  }

  if (isOwner && isCurrentMonth) {
    const gearBtn = document.createElement("button");
    gearBtn.className = "cal-badge-gear";
    gearBtn.title = "Manage activities";
    gearBtn.textContent = "\u26ef";
    gearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openManageActivitiesModal(entry, yearMonth, currentUser, onMarkToggled);
    });
    badge.appendChild(gearBtn);
  }

  card.appendChild(badge);

  // ── Filter Bar ──────────────────────────────────────
  const filterBar = document.createElement("div");
  filterBar.className = "cal-filter-bar";
  filterBar.style.display = "none";
  card.appendChild(filterBar);

  // ── Calendar Body ───────────────────────────────────
  const calBody = document.createElement("div");
  calBody.className = "cal-card-body";
  card.appendChild(calBody);

  // ── Legend Footer ───────────────────────────────────
  const footer = document.createElement("div");
  footer.className = "cal-card-footer";
  card.appendChild(footer);

  let diaryDays = new Set();
  if (isOwner) {
    getDiaryDays(currentUser.uid, yearMonth).then(days => {
      diaryDays = days;
      render();
    });
  }

  function render() {
    calBody.innerHTML = "";
    renderCalGrid(calBody, entry, cardYearMonth, isCurrentMonth, todayDate, activeFilter, isOwner, color, marker, onDayTap, diaryDays);
    renderFilterBar(filterBar, activeFilter, entry.activities, onFilterClear);
    renderLegend(footer, entry, (activityName) => {
      activeFilter = activeFilter === activityName ? null : activityName;
      render();
    });
    if (activeFilter) {
      footer.querySelectorAll(".cal-legend-item").forEach(el => {
        el.classList.toggle(
          "cal-legend-item--active",
          el.querySelector(".cal-legend-name").textContent === activeFilter
        );
      });
    }
  }

  function onDayTap(day) {
    const isFuture = isCurrentMonth && day > todayDate;
    if (isFuture) return;
    showDaySheet(day, entry, yearMonth, isOwner, isCurrentMonth, todayDate, marker,
      async (activity, newMarkedDays) => {
        if (!entry.marks) entry.marks = {};
        entry.marks[activity] = newMarkedDays;
        render();
        if (onMarkToggled) onMarkToggled(entry);
        try {
          const logRef = doc(db, "logs", yearMonth, "entries", entry.id);
          const logSnap = await getDoc(logRef);
          if (logSnap.exists()) {
            await updateDoc(logRef, { [`marks.${activity}`]: newMarkedDays });
          } else {
            await setDoc(logRef, { userId: entry.id, yearMonth, marks: { [activity]: newMarkedDays } });
          }
        } catch (err) {
          console.error("Toggle error:", err);
          showToast("Couldn't save. Try again.", "error");
        }
      },
      (activityName) => {
        activeFilter = activityName;
        render();
        document.querySelector(".day-sheet-overlay")?.remove();
      }
    );
  }

  function onFilterClear() {
    activeFilter = null;
    render();
  }

  render();
  return card;
}

// ─── RENDER CALENDAR GRID ───────────────────────────
function renderCalGrid(container, entry, yearMonth, isCurrentMonth, todayDate, activeFilter, isOwner, color, marker, onDayTap, diaryDays = new Set()) {
  const daysInMonth = getDaysInMonth(yearMonth);
  const marks = entry.marks || {};
  const activities = entry.activities || [];

  const headers = document.createElement("div");
  headers.className = "cal-grid-headers";
  ["S","M","T","W","T","F","S"].forEach(d => {
    const h = document.createElement("div");
    h.className = "cal-grid-header";
    h.textContent = d;
    headers.appendChild(h);
  });
  container.appendChild(headers);

  const grid = document.createElement("div");
  grid.className = "cal-grid-days";

  const [year, month] = yearMonth.split("-").map(Number);
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  for (let i = 0; i < firstDayOfWeek; i++) {
    grid.appendChild(document.createElement("div"));
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    cell.className = "cal-grid-day";

    const isToday  = isCurrentMonth && d === todayDate;
    const isFuture = isCurrentMonth && d > todayDate;

    if (isToday)  cell.classList.add("cal-day-today");
    if (isFuture) cell.classList.add("cal-day-future");

    // Date number — top right
    const dayNum = document.createElement("span");
    dayNum.className = "cal-day-num";
    dayNum.textContent = d;
    cell.appendChild(dayNum);

    if (activeFilter) {
      // ── Single-activity filter mode ──────────────
      const actIndex = activities.indexOf(activeFilter);
      const actColor = getActivityColor(actIndex);
      const markedDays = marks[activeFilter] || [];
      if (markedDays.includes(d) && !isFuture) {
        cell.classList.add("cal-day-done");
        // Show single dot in that activity colour
        const dotsRow = document.createElement("div");
        dotsRow.className = "cal-day-dots";
        const dot = document.createElement("span");
        dot.className = "cal-day-dot";
        dot.style.background = actColor;
        dotsRow.appendChild(dot);
        cell.appendChild(dotsRow);
      }
    } else {
      // ── Normal mode: coloured dots per logged activity ──
      if (!isFuture) {
        const loggedHabits = activities
          .map((act, i) => ({ act, color: getActivityColor(i) }))
          .filter(({ act }) => (marks[act] || []).includes(d));

        if (loggedHabits.length > 0) {
          const allDone = loggedHabits.length === activities.length;
          if (allDone) cell.classList.add("cal-day-full");
          else         cell.classList.add("cal-day-partial");

          const visible  = loggedHabits.slice(0, MAX_VISIBLE_DOTS);
          const overflow = loggedHabits.slice(MAX_VISIBLE_DOTS);

          const dotsRow = document.createElement("div");
          dotsRow.className = "cal-day-dots";

          visible.forEach(({ color }) => {
            const dot = document.createElement("span");
            dot.className = "cal-day-dot";
            dot.style.background = color;
            dotsRow.appendChild(dot);
          });

          if (overflow.length > 0) {
            // Tap-to-expand popover for >5 habits
            const moreDot = document.createElement("span");
            moreDot.className = "cal-day-dot cal-day-dot--more";
            moreDot.textContent = `+${overflow.length}`;
            moreDot.title = overflow.map(h => h.act).join(", ");
            dotsRow.appendChild(moreDot);
          }

          cell.appendChild(dotsRow);

          // Overflow popover on tap/click
          if (overflow.length > 0) {
            cell.addEventListener("click", (e) => {
              e.stopPropagation();
              document.querySelectorAll(".cal-overflow-popover").forEach(p => p.remove());
              const pop = document.createElement("div");
              pop.className = "cal-overflow-popover";
              loggedHabits.forEach(({ act, color }) => {
                const item = document.createElement("span");
                item.className = "cal-overflow-item";
                item.innerHTML = `<i style="background:${color}"></i>${act}`;
                pop.appendChild(item);
              });
              cell.appendChild(pop);
              setTimeout(() => {
                document.addEventListener("click", () => pop.remove(), { once: true });
              }, 0);
            }, { capture: true });
          }
        }
      }
    }

    if (!isFuture && diaryDays.has(d)) {
      const diaryDot = document.createElement("span");
      diaryDot.className = "cal-diary-dot";
      cell.appendChild(diaryDot);
    }

    if (!isFuture) {
      cell.style.cursor = "pointer";
      cell.addEventListener("click", () => onDayTap(d));
    }

    grid.appendChild(cell);
  }

  container.appendChild(grid);
}

// ─── RENDER FILTER BAR ──────────────────────────────
function renderFilterBar(filterBar, activeFilter, activities, onFilterClear) {
  if (!activeFilter) {
    filterBar.style.display = "none";
    filterBar.innerHTML = "";
    return;
  }
  filterBar.style.display = "flex";
  const actIndex = activities.indexOf(activeFilter);
  const actColor = getActivityColor(actIndex);
  filterBar.innerHTML = `
    <span class="filter-label">Showing:</span>
    <span class="filter-pill" style="background:${actColor};color:white;">
      ${activeFilter} \u00d7
    </span>
    <span class="filter-hint">tap pill to clear</span>
  `;
  filterBar.querySelector(".filter-pill").addEventListener("click", onFilterClear);
}

// ─── RENDER ACTIVITY LEGEND (replaces stats footer) ─
function renderLegend(footer, entry, onActivityClick = null) {
  const activities = entry.activities || [];
  footer.innerHTML = "";

  if (activities.length === 0) return;

  const list = document.createElement("div");
  list.className = "cal-legend";

  activities.forEach((act, i) => {
    const color = getActivityColor(i);
    const item = document.createElement("div");
    item.className = "cal-legend-item";
    if (onActivityClick) {
      item.classList.add("cal-legend-item--clickable");
      item.addEventListener("click", () => onActivityClick(act));
    }
    item.innerHTML = `
      <span class="cal-legend-dot" style="background:${color}"></span>
      <span class="cal-legend-name">${act}</span>
    `;
    list.appendChild(item);
  });

  footer.appendChild(list);
}

// ─── SHOW DAY SHEET ─────────────────────────────────
function showDaySheet(day, entry, yearMonth, isOwner, isCurrentMonth, todayDate, marker, onToggle, onFilter) {
  document.querySelector(".day-sheet-overlay")?.remove();

  const activities = entry.activities || [];
  const marks = entry.marks || {};
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const dateLabel = date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const isToday = isCurrentMonth && day === todayDate;

  const overlay = document.createElement("div");
  overlay.className = "day-sheet-overlay";

  const sheet = document.createElement("div");
  sheet.className = "day-sheet";
  sheet.innerHTML = `<div class="day-sheet-handle"></div>`;

  const dateEl = document.createElement("div");
  dateEl.className = "day-sheet-date";
  dateEl.textContent = isToday ? `${dateLabel} \u2014 today \u2728` : dateLabel;
  sheet.appendChild(dateEl);

  activities.forEach((activity, index) => {
    const actColor = getActivityColor(index);
    const markedDays = [...(marks[activity] || [])];
    const isMarked = markedDays.includes(day);

    const row = document.createElement("div");
    row.className = "day-sheet-row";

    const circle = document.createElement("div");
    circle.className = "day-sheet-circle";
    circle.style.borderColor = actColor;
    if (isMarked) {
      circle.classList.add("done");
      circle.style.background = actColor;
      circle.textContent = MARKER_SYMBOLS[marker] || "\u25cf";
      circle.style.color = "white";
    }

    const name = document.createElement("div");
    name.className = "day-sheet-name";
    name.textContent = activity;

    row.appendChild(circle);
    row.appendChild(name);
    sheet.appendChild(row);

    if (isOwner) {
      row.style.cursor = "pointer";
      row.addEventListener("click", () => {
        const idx = markedDays.indexOf(day);
        if (idx > -1) {
          markedDays.splice(idx, 1);
          circle.classList.remove("done");
          circle.style.background = "";
          circle.textContent = "";
          circle.style.color = "";
        } else {
          markedDays.push(day);
          circle.classList.add("done");
          circle.style.background = actColor;
          circle.textContent = MARKER_SYMBOLS[marker] || "\u25cf";
          circle.style.color = "white";
        }
        onToggle(activity, markedDays);
      });
    }
  });

  if (isOwner) {
    const divider = document.createElement("div");
    divider.className = "day-sheet-diary-divider";
    sheet.appendChild(divider);

    const diarySection = document.createElement("div");
    diarySection.className = "day-sheet-diary-section";

    const diaryLabel = document.createElement("span");
    diaryLabel.className = "day-sheet-diary-label";
    diaryLabel.textContent = "diary.";
    diarySection.appendChild(diaryLabel);

    const diaryBody = document.createElement("div");
    diaryBody.className = "day-sheet-diary-body";
    diaryBody.innerHTML = `<span style="color:var(--text-faint);font-size:0.8rem">...</span>`;
    diarySection.appendChild(diaryBody);

    sheet.appendChild(diarySection);

    getDiaryEntry(entry.id, yearMonth, day).then(diaryEntry => {
      diaryBody.innerHTML = "";

      if (diaryEntry?.note) {
        const noteEl = document.createElement("div");
        noteEl.className = "day-sheet-diary-note";
        noteEl.textContent = diaryEntry.note;
        diaryBody.appendChild(noteEl);
      }

      if (diaryEntry?.photoUrl) {
        const thumb = document.createElement("img");
        thumb.className = "day-sheet-diary-thumb";
        thumb.src = diaryEntry.photoUrl;
        thumb.alt = "";
        diaryBody.appendChild(thumb);
      }

      const btn = document.createElement("button");
      btn.className = "day-sheet-diary-btn";
      btn.textContent = diaryEntry ? "edit entry \u2192" : "add entry \u2192";
      btn.addEventListener("click", () => {
        dismissSheet();
        openDiaryPage(day, entry, yearMonth, entry.id, diaryEntry || null);
      });
      diaryBody.appendChild(btn);
    });
  }

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  document.body.style.overscrollBehaviorY = "none";

  function dismissSheet() {
    sheet.style.transition = "transform 0.22s ease";
    sheet.style.transform = "translateY(100%)";
    document.body.style.overscrollBehaviorY = "";
    setTimeout(() => overlay.remove(), 220);
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) dismissSheet();
  });

  // Swipe-to-dismiss
  const handle = sheet.querySelector(".day-sheet-handle");
  let swipeStartY = 0;
  let swipeActive = false;

  sheet.addEventListener("touchstart", (e) => {
    const touch = e.touches[0];
    const onHandle = handle.contains(e.target) || e.target === handle;
    if (!onHandle && sheet.scrollTop > 0) return;
    swipeStartY = touch.clientY;
    swipeActive = true;
    sheet.style.transition = "";
  }, { passive: true });

  sheet.addEventListener("touchmove", (e) => {
    if (!swipeActive) return;
    const dy = e.touches[0].clientY - swipeStartY;
    if (dy <= 0) return;
    e.preventDefault();
    sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: false });

  sheet.addEventListener("touchend", (e) => {
    if (!swipeActive) return;
    swipeActive = false;
    const dy = e.changedTouches[0].clientY - swipeStartY;
    if (dy > 80) {
      dismissSheet();
    } else {
      sheet.style.transition = "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)";
      sheet.style.transform = "translateY(0)";
    }
  }, { passive: true });
}
