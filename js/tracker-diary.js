import { getDaysInMonth, getCurrentYearMonth, getActivityColor } from "./utils.js";
import { getDiaryDays, getDiaryEntry, getDiaryTheme, saveDiaryTheme } from "./diary.js";
import { openDiaryPage } from "./mobile-tracker.js";
import { DIARY_THEMES, DEFAULT_DIARY_THEME } from "./diary-themes.js";

// ─── MODULE-LEVEL DIARY ENTRY CACHE ───────────────────────────
const _diaryEntryCache = new Map();
function _cacheKey(userId, yearMonth, d) { return `${userId}/${yearMonth}/${d}`; }
async function _getDiaryEntry(userId, yearMonth, d) {
  const key = _cacheKey(userId, yearMonth, d);
  if (_diaryEntryCache.has(key)) return _diaryEntryCache.get(key);
  const entry = await getDiaryEntry(userId, yearMonth, d);
  _diaryEntryCache.set(key, entry);
  return entry;
}

// ─── DIARY CROSSFADE HELPER ────────────────────────────────
function crossfadeDiaryOverlay(oldOverlay, buildNewOverlay) {
  buildNewOverlay();

  const newOverlay = [...document.querySelectorAll(".diary-modal-overlay, .diary-pages-overlay")].at(-1);

  if (newOverlay && newOverlay !== oldOverlay) {
    newOverlay.style.transition = "none";
    newOverlay.style.opacity = "1";
    requestAnimationFrame(() => { newOverlay.style.transition = ""; });
  }

  oldOverlay.style.transition = "opacity 0.22s ease";
  oldOverlay.style.opacity = "0";
  setTimeout(() => { oldOverlay.remove(); }, 250);
}

// ─── PART B: CLOSED NOTEBOOK ─────────────────────────────
export async function renderDiaryNotebook(userId, yearMonth, theme = DEFAULT_DIARY_THEME) {
  const t = DIARY_THEMES[theme] || DIARY_THEMES[DEFAULT_DIARY_THEME];

  const diaryDays = await getDiaryDays(userId, yearMonth);
  const filledCount = diaryDays.size;
  const [year, month] = yearMonth.split("-").map(Number);
  const monthName = new Date(year, month - 1, 1).toLocaleString("default", { month: "long" });

  const wrap = document.createElement("div");
  wrap.className = "diary-nb-closed";

  const shadow = document.createElement("div");
  shadow.className = "diary-nb-shadow";
  shadow.style.background = t.shadowColor;
  wrap.appendChild(shadow);

  const book = document.createElement("div");
  book.className = "diary-nb-book";
  book.classList.add(`diary-theme-${theme}`);
  book.style.borderColor = t.bookBorder;

  const spine = document.createElement("div");
  spine.className = "diary-nb-spine";
  spine.style.background = t.spineBg;
  spine.style.borderRight = `2px solid ${t.spineRightBorder}`;
  for (let i = 0; i < 9; i++) {
    const hole = document.createElement("span");
    hole.className = "diary-nb-hole";
    hole.style.background = t.holeBg;
    spine.appendChild(hole);
  }
  book.appendChild(spine);

  const cover = document.createElement("div");
  cover.className = "diary-nb-cover";
  cover.style.background = t.coverGradient;

  const gutter = document.createElement("div");
  gutter.className = "diary-nb-gutter";
  gutter.style.background = t.gutterBg;
  cover.appendChild(gutter);

  const pagesEdge = document.createElement("div");
  pagesEdge.className = "diary-nb-pages-edge";
  cover.appendChild(pagesEdge);

  const ribbon = document.createElement("div");
  ribbon.className = "diary-nb-ribbon";
  ribbon.style.background = t.ribbonBg;
  ribbon.style.right = "18px";
  ribbon.style.left = "auto";
  cover.appendChild(ribbon);

  const content = document.createElement("div");
  content.className = "diary-nb-content";

  const top = document.createElement("div");
  const title = document.createElement("h2");
  title.className = "diary-nb-title";
  title.textContent = "diary.";
  title.style.color = t.titleColor;
  const monthEl = document.createElement("p");
  monthEl.className = "diary-nb-month";
  monthEl.textContent = `${monthName} ${year}`;
  monthEl.style.color = t.monthColor;
  const tagline = document.createElement("p");
  tagline.className = "diary-nb-tagline";
  tagline.textContent = "i show up. period.";
  tagline.style.color = t.taglineColor;
  const rule = document.createElement("div");
  rule.className = "diary-nb-rule";
  rule.style.background = t.ruleColor;
  top.appendChild(title);
  top.appendChild(monthEl);
  top.appendChild(tagline);
  top.appendChild(rule);
  content.appendChild(top);

  const bottom = document.createElement("div");
  bottom.className = "diary-nb-bottom";
  const stat = document.createElement("div");
  stat.className = "diary-nb-stat";
  stat.innerHTML = `<strong>${filledCount}</strong><span>entries</span>`;
  stat.querySelector("strong").style.color = t.statColor;
  stat.querySelector("span").style.color = t.statLabelColor;
  const hint = document.createElement("span");
  hint.className = "diary-nb-hint";
  hint.textContent = "read it \u2192";
  hint.style.color = t.hintColor;
  bottom.appendChild(stat);
  bottom.appendChild(hint);
  content.appendChild(bottom);

  cover.appendChild(content);
  book.appendChild(cover);
  wrap.appendChild(book);

  // ── Palette button ──────────────────────────────────────
  const paletteBtn = document.createElement("button");
  paletteBtn.className = "diary-nb-palette-btn";
  paletteBtn.innerHTML = "🎨";
  paletteBtn.title = "Change diary color";
  wrap.appendChild(paletteBtn);

  const swatchColors = { coral: "#C3342B", cream: "#ede2d0", indigo: "#2A2E45" };

  paletteBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    wrap.classList.toggle("diary-nb-palette-open");
    const existing = wrap.querySelector(".diary-nb-palette-popover");
    if (existing) { existing.remove(); return; }

    const popover = document.createElement("div");
    popover.className = "diary-nb-palette-popover";

    for (const key of Object.keys(DIARY_THEMES)) {
      const btn = document.createElement("button");
      btn.className = "diary-nb-swatch";
      btn.style.background = swatchColors[key];
      if (key === theme) btn.classList.add("diary-nb-swatch--active");
      btn.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        await saveDiaryTheme(userId, key);
        wrap.querySelector(".diary-nb-palette-popover").remove();
        wrap.classList.remove("diary-nb-palette-open");
        const col = wrap.closest(".mylog-diary-col");
        const newNb = await renderDiaryNotebook(userId, yearMonth, key);
        col.style.transition = "opacity 0.3s ease";
        col.style.opacity = "0";
        setTimeout(() => {
          col.innerHTML = "";
          col.appendChild(newNb);
          requestAnimationFrame(() => { col.style.opacity = "1"; });
        }, 300);
      });
      popover.appendChild(btn);
    }
    wrap.appendChild(popover);
  });

  wrap.addEventListener("click", () => openDiaryModal(userId, yearMonth, diaryDays, theme));
  return wrap;
}

// ─── PART C: OPEN NOTEBOOK MODAL ─────────────────────────
export function openDiaryModal(userId, yearMonth, diaryDays, theme = DEFAULT_DIARY_THEME, initialDay = null) {
  const t = DIARY_THEMES[theme] || DIARY_THEMES[DEFAULT_DIARY_THEME];
  const [year, month] = yearMonth.split("-").map(Number);
  const daysInMonth = getDaysInMonth(yearMonth);
  const isCurrentMonth = yearMonth === getCurrentYearMonth();
  const todayDate = new Date().getDate();
  const monthName = new Date(year, month - 1, 1).toLocaleString("default", { month: "long" });
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  const overlay = document.createElement("div");
  overlay.className = "diary-modal-overlay";
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  const book = document.createElement("div");
  book.className = "diary-modal-book";
  book.addEventListener("click", (e) => e.stopPropagation());

  ["tl","tr","bl","br"].forEach(pos => {
    const c = document.createElement("div");
    c.className = `diary-modal-corner diary-modal-corner--${pos}`;
    c.style.background = t.cornerColor;
    book.appendChild(c);
  });

  const spine = document.createElement("div");
  spine.className = "diary-modal-spine";
  spine.style.background = t.spineBg;
  spine.style.borderRight = `2px solid ${t.spineRightBorder}`;
  for (let i = 0; i < 8; i++) {
    const hole = document.createElement("span");
    hole.className = "diary-nb-hole";
    hole.style.background = t.holeBg;
    spine.appendChild(hole);
  }
  book.appendChild(spine);

  const leftPage = document.createElement("div");
  leftPage.className = "diary-modal-left";

  const leftHead = document.createElement("div");
  leftHead.className = "diary-modal-left-head";
  leftHead.innerHTML = `
    <div class="diary-modal-left-head-title">diary.</div>
    <div class="diary-modal-left-head-sub">${monthName} ${year} \u00b7 ${diaryDays.size} pages filled</div>
  `;

  const swatchColors = { coral: "#C3342B", cream: "#ede2d0", indigo: "#2A2E45" };
  const swatchRow = document.createElement("div");
  swatchRow.className = "diary-modal-swatch-row";
  for (const key of Object.keys(DIARY_THEMES)) {
    const btn = document.createElement("button");
    btn.className = "diary-modal-swatch";
    btn.style.background = swatchColors[key];
    if (key === theme) btn.classList.add("diary-modal-swatch--active");
    btn.addEventListener("click", async () => {
      await saveDiaryTheme(userId, key);
      crossfadeDiaryOverlay(overlay, () => openDiaryModal(userId, yearMonth, diaryDays, key, activeDay));
      const col = document.querySelector(".mylog-diary-col");
      if (col) {
        const newNb = await renderDiaryNotebook(userId, yearMonth, key);
        col.style.transition = "opacity 0.3s ease";
        col.style.opacity = "0";
        setTimeout(() => {
          col.innerHTML = "";
          col.appendChild(newNb);
          requestAnimationFrame(() => { col.style.opacity = "1"; });
        }, 300);
      }
    });
    swatchRow.appendChild(btn);
  }
  leftHead.appendChild(swatchRow);
  leftPage.appendChild(leftHead);

  const toggle = document.createElement("div");
  toggle.className = "diary-modal-left-toggle";
  const calBtn = document.createElement("button");
  calBtn.innerHTML = `<img src="/assets/icons/calendar.svg" width="14" height="14" alt="" style="vertical-align:-2px;opacity:0.75;margin-right:4px;"> Calendar`;
  calBtn.className = "active";
  const pagesBtn = document.createElement("button");
  pagesBtn.textContent = "\ud83d\udcc4 Pages";
  toggle.appendChild(calBtn);
  toggle.appendChild(pagesBtn);
  leftPage.appendChild(toggle);

  pagesBtn.addEventListener("click", () => {
    crossfadeDiaryOverlay(overlay, () => openDiaryPagesModal(userId, yearMonth, diaryDays, theme));
  });

  const calArea = document.createElement("div");
  calArea.className = "diary-modal-left-cal";

  const calMonthEl = document.createElement("div");
  calMonthEl.className = "diary-modal-cal-month";
  calMonthEl.textContent = `${monthName} ${year}`;
  calArea.appendChild(calMonthEl);

  const headers = document.createElement("div");
  headers.className = "diary-modal-cal-headers";
  ["S","M","T","W","T","F","S"].forEach(d => {
    const h = document.createElement("div");
    h.className = "diary-modal-cal-header";
    h.textContent = d;
    headers.appendChild(h);
  });
  calArea.appendChild(headers);

  const calGrid = document.createElement("div");
  calGrid.className = "diary-modal-cal-grid";

  const dayCells = {};
  for (let i = 0; i < firstDayOfWeek; i++) {
    const off = document.createElement("div");
    off.className = "diary-modal-cal-day offset";
    calGrid.appendChild(off);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    cell.className = "diary-modal-cal-day";
    const isFuture = isCurrentMonth && d > todayDate;
    if (isFuture) cell.style.opacity = "0.3";
    cell.innerHTML = `<span>${d}</span>`;
    if (diaryDays.has(d)) {
      cell.classList.add("has-entry");
      const dot = document.createElement("span");
      dot.className = "diary-modal-cal-dot";
      cell.appendChild(dot);
    }
    if (!isFuture) cell.addEventListener("click", () => selectDay(d));
    dayCells[d] = cell;
    calGrid.appendChild(cell);
  }
  calArea.appendChild(calGrid);

  const fillWrap = document.createElement("div");
  fillWrap.className = "diary-modal-cal-fill";
  const fillBar = document.createElement("div");
  fillBar.className = "diary-modal-cal-fill-bar";
  const maxDays = isCurrentMonth ? todayDate : daysInMonth;
  fillBar.style.width = maxDays > 0 ? `${(diaryDays.size / maxDays) * 100}%` : "0%";
  fillWrap.appendChild(fillBar);
  calArea.appendChild(fillWrap);

  leftPage.appendChild(calArea);
  book.appendChild(leftPage);

  const crease = document.createElement("div");
  crease.className = "diary-modal-crease";
  book.appendChild(crease);

  const rightPage = document.createElement("div");
  rightPage.className = "diary-modal-right";

  const closeBtn = document.createElement("button");
  closeBtn.className = "diary-modal-close";
  closeBtn.textContent = "\u2715";
  closeBtn.addEventListener("click", () => overlay.remove());
  rightPage.appendChild(closeBtn);

  const rightContent = document.createElement("div");
  rightContent.className = "diary-modal-right-content";
  rightPage.appendChild(rightContent);

  // ── Bottom page nav — lives outside rightContent so it doesn't fade
  const pageNav = document.createElement("div");
  pageNav.className = "diary-modal-page-nav";
  const prevNavBtn = document.createElement("button");
  prevNavBtn.className = "diary-modal-pf-btn";
  prevNavBtn.textContent = "\u2190";
  prevNavBtn.disabled = true;
  const nextNavBtn = document.createElement("button");
  nextNavBtn.className = "diary-modal-pf-btn";
  nextNavBtn.textContent = "\u2192";
  nextNavBtn.disabled = true;
  pageNav.appendChild(prevNavBtn);
  pageNav.appendChild(nextNavBtn);
  rightPage.appendChild(pageNav);

  book.appendChild(rightPage);
  overlay.appendChild(book);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.classList.add("is-open"); });

  let activeDay = null;
  let selectSeq = 0;

  function updatePageNav(d) {
    const maxNext = isCurrentMonth ? todayDate : daysInMonth;
    const prevDay = d - 1;
    const nextDay = d + 1;

    prevNavBtn.onclick = null;
    nextNavBtn.onclick = null;

    if (prevDay >= 1) {
      prevNavBtn.textContent = `\u2190 ${monthName.slice(0,3)} ${prevDay}`;
      prevNavBtn.disabled = false;
      prevNavBtn.onclick = () => selectDay(prevDay);
    } else {
      prevNavBtn.textContent = "\u2190";
      prevNavBtn.disabled = true;
    }

    if (nextDay <= maxNext) {
      nextNavBtn.textContent = `${monthName.slice(0,3)} ${nextDay} \u2192`;
      nextNavBtn.disabled = false;
      nextNavBtn.onclick = () => selectDay(nextDay);
    } else {
      nextNavBtn.textContent = "\u2192";
      nextNavBtn.disabled = true;
    }
  }

  async function selectDay(d) {
    if (activeDay && dayCells[activeDay]) dayCells[activeDay].classList.remove("active");
    activeDay = d;
    if (dayCells[d]) dayCells[d].classList.add("active");
    updatePageNav(d);

    const cached = _diaryEntryCache.has(_cacheKey(userId, yearMonth, d));
    if (!cached) {
      rightContent.innerHTML = `<div style="color:#B5A88A;font-family:'Caveat',cursive;font-size:1rem;padding-top:20px">loading...</div>`;
    }
    const diaryEntry = await _getDiaryEntry(userId, yearMonth, d);

    function renderContent() {
      rightContent.innerHTML = "";

      const date = new Date(year, month - 1, d);
      const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" });

      if (diaryEntry) {
        const dateEl = document.createElement("div");
        dateEl.className = "diary-modal-entry-date";
        dateEl.innerHTML = `${dayOfWeek}, <strong>${d}</strong>`;
        rightContent.appendChild(dateEl);

        const activities = window._currentEntry?.activities || [];
        if (activities.length > 0) {
          const chipsRow = document.createElement("div");
          chipsRow.className = "diary-modal-entry-chips";
          const marks = window._currentEntry?.marks || {};
          activities.forEach((act, i) => {
            const marked = (marks[act] || []).includes(d);
            const chip = document.createElement("span");
            chip.className = marked ? "diary-modal-entry-chip" : "diary-modal-entry-chip diary-modal-entry-chip--undone";
            if (marked) chip.style.background = getActivityColor(i);
            chip.textContent = marked ? `\u2713 ${act}` : act;
            chipsRow.appendChild(chip);
          });
          rightContent.appendChild(chipsRow);
        }

        if (diaryEntry.note) {
          const noteEl = document.createElement("div");
          noteEl.className = "diary-modal-entry-note";
          noteEl.textContent = diaryEntry.note;
          rightContent.appendChild(noteEl);
        }

        if (diaryEntry.photoUrl) {
          const polaroid = document.createElement("div");
          polaroid.className = "diary-modal-polaroid";
          const img = document.createElement("img");
          img.src = diaryEntry.photoUrl;
          img.alt = "";
          polaroid.appendChild(img);
          rightContent.appendChild(polaroid);
        }

        const editBtn = document.createElement("button");
        editBtn.className = "diary-modal-edit-btn";
        editBtn.textContent = "\u270f\ufe0f Edit entry";
        editBtn.addEventListener("click", () => {
          crossfadeDiaryOverlay(overlay, () => openDiaryPage(d, window._currentEntry, yearMonth, userId, diaryEntry, () => {
            _diaryEntryCache.delete(_cacheKey(userId, yearMonth, d));
            openDiaryModal(userId, yearMonth, diaryDays, theme);
          }));
        });
        rightContent.appendChild(editBtn);
      } else {
        const emptyDate = document.createElement("div");
        emptyDate.className = "diary-modal-empty-date";
        emptyDate.innerHTML = `${dayOfWeek}, <strong style="color:var(--color-primary)">${d}</strong>`;
        rightContent.appendChild(emptyDate);

        const emptyText = document.createElement("div");
        emptyText.className = "diary-modal-empty-text";
        emptyText.textContent = "this page is blank...";
        rightContent.appendChild(emptyText);

        const writeBtn = document.createElement("button");
        writeBtn.className = "diary-modal-write-btn";
        writeBtn.textContent = "\u270f\ufe0f Write something";
        writeBtn.addEventListener("click", () => {
          crossfadeDiaryOverlay(overlay, () => openDiaryPage(d, window._currentEntry, yearMonth, userId, null, () => {
            _diaryEntryCache.delete(_cacheKey(userId, yearMonth, d));
            openDiaryModal(userId, yearMonth, diaryDays, theme);
          }));
        });
        rightContent.appendChild(writeBtn);
      }

      rightContent.style.opacity = "1";
    }

    if (rightContent.children.length > 0) {
      const seq = ++selectSeq;
      rightContent.style.opacity = "0";
      setTimeout(() => {
        if (seq !== selectSeq) return;
        renderContent();
        requestAnimationFrame(() => { rightContent.style.opacity = "1"; });
      }, 130);
    } else {
      renderContent();
      rightContent.style.opacity = "1";
    }
  }

  const startDay = initialDay !== null
    ? initialDay
    : (isCurrentMonth ? todayDate : (diaryDays.size > 0 ? Math.max(...diaryDays) : daysInMonth));
  selectDay(startDay);
}

// ─── PART D: PAGES MODAL ─────────────────────────────────
export function openDiaryPagesModal(userId, yearMonth, diaryDays, theme = DEFAULT_DIARY_THEME) {
  const t = DIARY_THEMES[theme] || DIARY_THEMES[DEFAULT_DIARY_THEME];
  const [year, month] = yearMonth.split("-").map(Number);
  const daysInMonth = getDaysInMonth(yearMonth);
  const isCurrentMonth = yearMonth === getCurrentYearMonth();
  const todayDate = new Date().getDate();
  const monthName = new Date(year, month - 1, 1).toLocaleString("default", { month: "long" });
  const maxDays = isCurrentMonth ? todayDate : daysInMonth;

  const overlay = document.createElement("div");
  overlay.className = "diary-pages-overlay";
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  const modal = document.createElement("div");
  modal.className = "diary-pages-modal";
  modal.style.borderColor = t.bookBorder;
  modal.addEventListener("click", (e) => e.stopPropagation());

  ["tl","tr","bl","br"].forEach(pos => {
    const c = document.createElement("div");
    c.className = `diary-pages-corner diary-pages-corner--${pos}`;
    c.style.background = t.cornerColor;
    modal.appendChild(c);
  });

  const head = document.createElement("div");
  head.className = "diary-pages-head";

  const headTextWrap = document.createElement("div");
  headTextWrap.style.flex = "1";
  const headTitle = document.createElement("div");
  headTitle.className = "diary-pages-head-title";
  headTitle.textContent = `diary. \u2014 All Pages`;
  const headSub = document.createElement("div");
  headSub.className = "diary-pages-head-sub";
  headSub.textContent = `${monthName} ${year} \u00b7 ${diaryDays.size} of ${maxDays} filled`;
  headTextWrap.appendChild(headTitle);
  headTextWrap.appendChild(headSub);
  head.appendChild(headTextWrap);

  // No fill bar — subtitle already states the count

  const backBtn = document.createElement("button");
  backBtn.className = "diary-pages-back-btn";
  backBtn.textContent = "\u2190 back to diary";
  backBtn.addEventListener("click", () => {
    crossfadeDiaryOverlay(overlay, () => openDiaryModal(userId, yearMonth, diaryDays, theme));
  });
  head.appendChild(backBtn);

  const closeBtn = document.createElement("button");
  closeBtn.className = "diary-pages-close-btn";
  closeBtn.textContent = "\u2715";
  closeBtn.addEventListener("click", () => overlay.remove());
  head.appendChild(closeBtn);

  modal.appendChild(head);

  const gridWrap = document.createElement("div");
  gridWrap.className = "diary-pages-grid-wrap";
  const grid = document.createElement("div");
  grid.className = "diary-pages-grid";

  const filledDays = Array.from(diaryDays).sort((a, b) => a - b);

  async function loadAndRender() {
    await Promise.all(filledDays.map(d => _getDiaryEntry(userId, yearMonth, d)));

    let staggerIdx = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const isFuture = isCurrentMonth && d > todayDate;
      if (isFuture) continue;

      const mini = document.createElement("div");
      mini.className = "diary-mini-page";
      const isFilled = diaryDays.has(d);
      if (!isFilled) mini.classList.add("empty");
      if (isCurrentMonth && d === todayDate) mini.classList.add("today");

      mini.innerHTML = `<div class="diary-mini-day">${d}</div>`;

      const entry = _diaryEntryCache.get(_cacheKey(userId, yearMonth, d));
      if (entry?.note) {
        const noteEl = document.createElement("div");
        noteEl.className = "diary-mini-note";
        noteEl.textContent = entry.note;
        mini.appendChild(noteEl);
      }
      if (entry?.photoUrl) {
        const polaroidDiv = document.createElement("div");
        polaroidDiv.className = "diary-mini-polaroid";
        const polaroidInner = document.createElement("div");
        polaroidInner.className = "diary-mini-polaroid-inner";
        const thumb = document.createElement("img");
        thumb.src = entry.photoUrl;
        thumb.alt = "";
        thumb.style.width = "100%";
        thumb.style.height = "100%";
        thumb.style.objectFit = "cover";
        thumb.style.display = "block";
        polaroidInner.appendChild(thumb);
        polaroidDiv.appendChild(polaroidInner);
        mini.appendChild(polaroidDiv);
      }

      if (isFilled) {
        const dayToOpen = d;
        mini.addEventListener("click", () => {
          crossfadeDiaryOverlay(overlay, () => openDiaryModal(userId, yearMonth, diaryDays, theme, dayToOpen));
        });
      }

      if (!isFilled) {
        grid.appendChild(mini);
      } else {
        mini.style.opacity = "0";
        grid.appendChild(mini);
        const delay = Math.min(staggerIdx * 25, 200);
        setTimeout(() => { mini.style.opacity = "1"; }, delay);
        staggerIdx++;
      }
    }
  }

  loadAndRender();
  gridWrap.appendChild(grid);
  modal.appendChild(gridWrap);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.classList.add("is-open"); });
}
