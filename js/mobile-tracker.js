import { db } from "./firebase-config.js";
import { getDiaryDays, getDiaryEntry, saveDiaryEntry, uploadDiaryPhoto, deleteDiaryPhoto } from "./diary.js";
import {
  doc, getDoc, setDoc, updateDoc,
  arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getDaysInMonth, getCurrentYearMonth } from "./utils.js";
import { getActivityColor } from "./tracker.js";
import { showToast } from "./ui.js";
import { computeStatsFromEntry } from "./stats.js";
import { icon, STICKER_ICONS } from "./icons.js";

const MARKER_SYMBOLS = {
  square:   "■",
  circle:   "●",
  star:     "★",
  heart:    "♥",
  check:    "✓",
  x:        "✗",
  scribble: "〰"
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
  const { isFollowing = false, showFollowBtn = false, onMarkToggled = null } = opts;
  const isOwner = currentUser && currentUser.uid === entry.id;
  const isCurrentMonth = yearMonth === getCurrentYearMonth();
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

  // ── Follow / Unfollow button ────────────────────────
  if (showFollowBtn && !isOwner && currentUser) {
    const followBtn = document.createElement("button");
    followBtn.className = `cal-follow-btn ${following ? "following" : ""}`;
    followBtn.innerHTML = following
      ? `<span class="follow-btn-check">✓</span> Following`
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
          followBtn.innerHTML = `<span class="follow-btn-check">✓</span> Following`;
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
    renderCalGrid(calBody, entry, yearMonth, isCurrentMonth, todayDate, activeFilter, isOwner, color, marker, onDayTap, diaryDays);
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
      ${activeFilter} ×
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
  dateEl.textContent = isToday ? `${dateLabel} — today ✨` : dateLabel;
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
      circle.textContent = MARKER_SYMBOLS[marker] || "●";
      circle.style.color = "white";
    }

    const name = document.createElement("div");
    name.className = "day-sheet-name";
    name.textContent = activity;

    const arrow = document.createElement("span");
    arrow.className = "day-sheet-arrow";
    arrow.textContent = "→";

    row.appendChild(circle);
    row.appendChild(name);
    row.appendChild(arrow);
    sheet.appendChild(row);

    if (isOwner) {
      circle.style.cursor = "pointer";
      circle.addEventListener("click", (e) => {
        e.stopPropagation();
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
          circle.textContent = MARKER_SYMBOLS[marker] || "●";
          circle.style.color = "white";
        }
        onToggle(activity, markedDays);
      });
    }

    name.style.cursor = "pointer";
    arrow.style.cursor = "pointer";
    const filterHandler = () => onFilter(activity);
    name.addEventListener("click", filterHandler);
    arrow.addEventListener("click", filterHandler);
  });

  const hint = document.createElement("div");
  hint.className = "day-sheet-hint";
  hint.textContent = isOwner
    ? "tap ○ to mark done · tap name → to filter calendar"
    : "tap name → to filter calendar";
  sheet.appendChild(hint);

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
      btn.textContent = diaryEntry ? "edit entry →" : "add entry →";
      btn.addEventListener("click", () => {
        overlay.remove();
        openDiaryPage(day, entry, yearMonth, entry.id, diaryEntry || null);
      });
      diaryBody.appendChild(btn);
    });
  }

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// ─── CROP UI ─────────────────────────────────────────
function showCropUI(file, onConfirm) {
  const overlay = document.createElement("div");
  overlay.className = "diary-crop-overlay";

  // Hint
  const hint = document.createElement("div");
  hint.textContent = "Drag to reposition · Pinch or scroll to zoom";
  hint.style.cssText = "font-size:0.72rem;color:rgba(255,255,255,0.5);text-align:center;";
  overlay.appendChild(hint);

  // Crop frame
  const frame = document.createElement("div");
  frame.className = "diary-crop-frame";

  const cropImg = document.createElement("img");
  cropImg.className = "diary-crop-img";
  frame.appendChild(cropImg);

  const grid = document.createElement("div");
  grid.className = "diary-crop-grid";
  frame.appendChild(grid);

  overlay.appendChild(frame);

  // Toolbar
  const toolbar = document.createElement("div");
  toolbar.className = "diary-crop-toolbar";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "diary-crop-cancel";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => overlay.remove());

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "diary-crop-confirm";
  confirmBtn.textContent = "Use Photo";

  toolbar.appendChild(cancelBtn);
  toolbar.appendChild(confirmBtn);
  overlay.appendChild(toolbar);
  document.body.appendChild(overlay);

  // State
  let imgNaturalW = 0, imgNaturalH = 0;
  let frameSize = 0;
  let scale = 1, minScale = 1;
  let dx = 0, dy = 0; // offset of img center from frame center

  function clampOffset() {
    // The rendered img dimensions
    const rw = imgNaturalW * scale;
    const rh = imgNaturalH * scale;
    // Max offset so the img edge doesn't go inside the frame
    const maxDx = Math.max(0, (rw - frameSize) / 2);
    const maxDy = Math.max(0, (rh - frameSize) / 2);
    dx = Math.max(-maxDx, Math.min(maxDx, dx));
    dy = Math.max(-maxDy, Math.min(maxDy, dy));
  }

  function applyTransform() {
    cropImg.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale})`;
  }

  cropImg.onload = () => {
    imgNaturalW = cropImg.naturalWidth;
    imgNaturalH = cropImg.naturalHeight;
    frameSize = frame.getBoundingClientRect().width;
    // Scale so shortest side fills frame
    minScale = frameSize / Math.min(imgNaturalW, imgNaturalH);
    scale = minScale;
    dx = 0; dy = 0;
    cropImg.style.left = "50%";
    cropImg.style.top = "50%";
    cropImg.style.width = imgNaturalW + "px";
    cropImg.style.height = imgNaturalH + "px";
    applyTransform();
  };

  const objectUrl = URL.createObjectURL(file);
  cropImg.src = objectUrl;

  // ── Drag (mouse + touch) ──────────────────────────
  let dragging = false, lastX = 0, lastY = 0;

  frame.addEventListener("mousedown", (e) => {
    dragging = true;
    lastX = e.clientX; lastY = e.clientY;
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    dx += e.clientX - lastX;
    dy += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    clampOffset(); applyTransform();
  });
  window.addEventListener("mouseup", () => { dragging = false; });

  // ── Touch drag + pinch ────────────────────────────
  let lastTouches = null, pinchStartDist = 0, pinchStartScale = 1;

  frame.addEventListener("touchstart", (e) => {
    e.preventDefault();
    lastTouches = e.touches;
    if (e.touches.length === 2) {
      const a = e.touches[0], b = e.touches[1];
      pinchStartDist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      pinchStartScale = scale;
    }
  }, { passive: false });

  frame.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const a = e.touches[0], b = e.touches[1];
      const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      scale = Math.max(minScale, Math.min(4, pinchStartScale * (dist / pinchStartDist)));
    } else if (e.touches.length === 1 && lastTouches && lastTouches.length === 1) {
      dx += e.touches[0].clientX - lastTouches[0].clientX;
      dy += e.touches[0].clientY - lastTouches[0].clientY;
    }
    lastTouches = e.touches;
    clampOffset(); applyTransform();
  }, { passive: false });

  frame.addEventListener("touchend", (e) => { lastTouches = e.touches; });

  // ── Scroll to zoom ────────────────────────────────
  frame.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.08 : 0.93;
    scale = Math.max(minScale, Math.min(4, scale * delta));
    clampOffset(); applyTransform();
  }, { passive: false });

  // ── Confirm: render to canvas 800×800 ─────────────
  confirmBtn.addEventListener("click", () => {
    frameSize = frame.getBoundingClientRect().width;
    const OUT = 800;
    const canvas = document.createElement("canvas");
    canvas.width = OUT; canvas.height = OUT;
    const ctx = canvas.getContext("2d");

    // In frame coords:
    // img center is at (frameSize/2 + dx, frameSize/2 + dy)
    // img rendered size is (imgNaturalW * scale, imgNaturalH * scale)
    // visible crop window in img coords:
    const renderedW = imgNaturalW * scale;
    const renderedH = imgNaturalH * scale;
    const imgCenterX = frameSize / 2 + dx; // px from frame left
    const imgCenterY = frameSize / 2 + dy;
    // Top-left of the frame in rendered-img coords
    const srcLeft = (imgNaturalW / 2) - (imgCenterX / scale);
    const srcTop  = (imgNaturalH / 2) - (imgCenterY / scale);
    const srcSize = frameSize / scale;

    ctx.drawImage(cropImg, srcLeft, srcTop, srcSize, srcSize, 0, 0, OUT, OUT);

    canvas.toBlob((blob) => {
      URL.revokeObjectURL(objectUrl);
      overlay.remove();
      const croppedFile = new File([blob], "diary-photo.jpg", { type: "image/jpeg" });
      onConfirm(croppedFile);
    }, "image/jpeg", 0.85);
  });
}

// ─── OPEN DIARY PAGE ────────────────────────────────
export function openDiaryPage(day, entry, yearMonth, userId, existingDiaryEntry, onSaved = null) {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const isCurrentMonth = yearMonth === getCurrentYearMonth();
  const todayDate = new Date().getDate();
  const isToday = isCurrentMonth && day === todayDate;

  const activities = entry.activities || [];
  const marks = entry.marks || {};

  let newPhotoFile = null;
  let photoToDelete = false;
  let currentPhotoUrl = existingDiaryEntry?.photoUrl || null;

  // ── Overlay ──────────────────────────────────────
  const overlay = document.createElement("div");
  overlay.className = "diary-page-overlay";

  // ── Top Nav ──────────────────────────────────────
  const nav = document.createElement("div");
  nav.className = "diary-page-nav";

  const backBtn = document.createElement("button");
  backBtn.className = "diary-page-nav-back";
  backBtn.textContent = "← back";
  backBtn.addEventListener("click", () => overlay.remove());

  const navTitle = document.createElement("span");
  navTitle.className = "diary-page-nav-title";
  navTitle.textContent = "diary.";

  const navSave = document.createElement("button");
  navSave.className = "diary-page-nav-save";
  navSave.textContent = "Save";
  navSave.disabled = true;

  nav.appendChild(backBtn);
  nav.appendChild(navTitle);
  nav.appendChild(navSave);
  overlay.appendChild(nav);

  // ── Date Hero ────────────────────────────────────
  const hero = document.createElement("div");
  hero.className = "diary-page-hero";

  const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" });
  const monthName = date.toLocaleDateString("en-US", { month: "long" });

  const dateBig = document.createElement("div");
  dateBig.className = "diary-page-date-big";
  dateBig.innerHTML = `${dayOfWeek}, <strong>${day}</strong>`;
  hero.appendChild(dateBig);

  const dateSub = document.createElement("div");
  dateSub.className = "diary-page-date-sub";
  dateSub.textContent = isToday ? "Today ✨" : monthName;
  hero.appendChild(dateSub);

  const chips = document.createElement("div");
  chips.className = "diary-habit-chips";
  activities.forEach((act, i) => {
    const marked = (marks[act] || []).includes(day);
    const chip = document.createElement("span");
    if (marked) {
      chip.className = "diary-habit-chip";
      chip.style.background = getActivityColor(i);
      chip.textContent = `✓ ${act}`;
    } else {
      chip.className = "diary-habit-chip diary-habit-chip--undone";
      chip.textContent = act;
    }
    chips.appendChild(chip);
  });
  hero.appendChild(chips);
  overlay.appendChild(hero);

  // ── Body ─────────────────────────────────────────
  const body = document.createElement("div");
  body.className = "diary-page-body";

  // Note section
  const noteLabel = document.createElement("div");
  noteLabel.className = "diary-section-label";
  noteLabel.textContent = "today's note";
  body.appendChild(noteLabel);

  const textarea = document.createElement("textarea");
  textarea.className = "diary-note-textarea";
  textarea.maxLength = 280;
  textarea.placeholder = "what was today like? how did it feel to show up...";
  textarea.value = existingDiaryEntry?.note || "";
  textarea.addEventListener("focus", () => { textarea.style.borderColor = "var(--color-primary)"; });
  textarea.addEventListener("blur",  () => { textarea.style.borderColor = "#D5C9A8"; });
  body.appendChild(textarea);

  const charCounter = document.createElement("div");
  charCounter.className = "diary-note-char";
  charCounter.textContent = `${textarea.value.length} / 280`;
  textarea.addEventListener("input", () => {
    charCounter.textContent = `${textarea.value.length} / 280`;
    updateDirty();
  });
  body.appendChild(charCounter);

  // Photo section
  const photoLabel = document.createElement("div");
  photoLabel.className = "diary-section-label";
  photoLabel.textContent = "photo";
  body.appendChild(photoLabel);

  const photoWrap = document.createElement("div");
  photoWrap.style.position = "relative";
  body.appendChild(photoWrap);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  body.appendChild(fileInput);

  function showPhotoPreview(src) {
    photoWrap.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "diary-photo-preview-wrap";

    const img = document.createElement("img");
    img.className = "diary-photo-preview";
    img.src = src;
    img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
    wrap.appendChild(img);

    const removeBtn = document.createElement("button");
    removeBtn.className = "diary-photo-remove-btn";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => {
      photoToDelete = true;
      newPhotoFile = null;
      currentPhotoUrl = null;
      showPhotoZone();
      updateDirty();
    });
    wrap.appendChild(removeBtn);
    photoWrap.appendChild(wrap);
  }

  function showPhotoZone() {
    photoWrap.innerHTML = "";
    const zone = document.createElement("div");
    zone.className = "diary-photo-zone";
    zone.innerHTML = `<span style="font-size:1.5rem;opacity:0.4">📷</span><span style="font-size:0.72rem;color:#7A6F55">add a photo</span>`;
    zone.addEventListener("click", () => fileInput.click());
    photoWrap.appendChild(zone);
  }

  if (currentPhotoUrl) {
    showPhotoPreview(currentPhotoUrl);
  } else {
    showPhotoZone();
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast("Photo must be under 10MB.", "error");
      return;
    }
    showCropUI(file, (croppedFile) => {
      newPhotoFile = croppedFile;
      photoToDelete = false;
      showPhotoPreview(URL.createObjectURL(croppedFile));
      updateDirty();
    });
  });

  // Save button (in body)
  const saveBtn = document.createElement("button");
  saveBtn.className = "diary-save-btn";
  saveBtn.textContent = "Save";
  saveBtn.disabled = true;
  body.appendChild(saveBtn);

  overlay.appendChild(body);
  document.body.appendChild(overlay);

  // ── Dirty tracking ───────────────────────────────
  function updateDirty() {
    const originalNote = existingDiaryEntry?.note || "";
    const isDirty = textarea.value !== originalNote || newPhotoFile !== null || photoToDelete;
    navSave.disabled = !isDirty;
    saveBtn.disabled = !isDirty;
  }

  // ── Save handler ─────────────────────────────────
  async function handleSave() {
    navSave.disabled = true;
    saveBtn.disabled = true;
    const originalNavText = navSave.textContent;
    navSave.textContent = "Saving...";
    saveBtn.textContent = "Saving...";

    try {
      let photoUrl = currentPhotoUrl;

      if (newPhotoFile) {
        photoUrl = await uploadDiaryPhoto(userId, yearMonth, day, newPhotoFile);
      } else if (photoToDelete) {
        await deleteDiaryPhoto(userId, yearMonth, day);
        photoUrl = null;
      }

      const noteValue = textarea.value.trim();
      const saveData = { note: noteValue };
      if (photoUrl !== undefined) saveData.photoUrl = photoUrl;

      await saveDiaryEntry(userId, yearMonth, day, saveData);

      showToast("Diary entry saved.", "info");
      overlay.remove();
      if (onSaved) onSaved();
    } catch (err) {
      console.error("Diary save error:", err);
      showToast("Couldn't save. Try again.", "error");
      navSave.disabled = false;
      saveBtn.disabled = false;
      navSave.textContent = originalNavText;
      saveBtn.textContent = "Save";
    }
  }

  navSave.addEventListener("click", handleSave);
  saveBtn.addEventListener("click", handleSave);
}

// ─── HELPERS ────────────────────────────────────────
function hexWithOpacity(hex, opacity) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}
