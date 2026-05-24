import { getDiaryDays, getDiaryEntry, getDiaryCover, getMonthCover, getActiveCover } from "./diary.js";
import { renderDiaryNotebook, openDiaryModal } from "./tracker-diary.js";
import { openMobileDiarySheet } from "./diary-mobile.js";
import { DEFAULT_DIARY_COVER } from "./diary-covers.js";
import { getCurrentYearMonth, getDaysInMonth } from "./utils.js";

const _entryCache = new Map();
const _cacheKey = (uid, ym, d) => `${uid}/${ym}/${d}`;
async function _getEntry(uid, ym, d) {
  const k = _cacheKey(uid, ym, d);
  if (_entryCache.has(k)) return _entryCache.get(k);
  const e = await getDiaryEntry(uid, ym, d);
  _entryCache.set(k, e);
  return e;
}

function isMobileWidth() {
  return window.matchMedia("(max-width: 767px)").matches;
}

const _DIARY_OVERLAY_SELS = ".diary-modal-overlay, .diary-pages-overlay, .mob-diary-overlay, .diary-page-overlay, .diary-page-backdrop";

// One save listener per loaded tab. A new loadDiaryTab call aborts the old.
let _saveListenerCtrl = null;

// After save, tracker-diary's onSaved chain reopens the diary modal. We
// intercept that here: yank any open diary overlays out of the DOM, and
// keep yanking new ones for ~800ms (covers the 350ms setTimeout in
// openDiaryPage's closeAll). MutationObserver callbacks run before paint,
// so the reopened modal never becomes visible.
function suppressOverlayReopens() {
  document.querySelectorAll(_DIARY_OVERLAY_SELS).forEach(n => n.remove());
  const obs = new MutationObserver(() => {
    document.querySelectorAll(_DIARY_OVERLAY_SELS).forEach(n => n.remove());
  });
  obs.observe(document.body, { childList: true });
  setTimeout(() => obs.disconnect(), 800);
}

function buildPhotoEl(photoUrl) {
  const polaroidDiv = document.createElement("div");
  polaroidDiv.className = "diary-mini-polaroid";
  const polaroidInner = document.createElement("div");
  polaroidInner.className = "diary-mini-polaroid-inner";
  const thumb = document.createElement("img");
  thumb.src = photoUrl;
  thumb.alt = "";
  thumb.style.width = "100%";
  thumb.style.height = "100%";
  thumb.style.objectFit = "cover";
  thumb.style.display = "block";
  polaroidInner.appendChild(thumb);
  polaroidDiv.appendChild(polaroidInner);
  return polaroidDiv;
}

function buildEmptyLines() {
  const lines = document.createElement("div");
  lines.className = "diary-mini-lines";
  for (let i = 0; i < 3; i++) {
    const line = document.createElement("div");
    line.className = "diary-mini-line";
    lines.appendChild(line);
  }
  return lines;
}

// Populates a page card for a given day. Used by both the initial render
// and the post-save surgical update so the two paths stay in sync.
function paintCard(card, day, entry, isToday) {
  card.innerHTML = "";
  card.classList.remove("empty");
  if (isToday) card.classList.add("today");

  const dayEl = document.createElement("div");
  dayEl.className = "diary-mini-day";
  dayEl.textContent = String(day);
  card.appendChild(dayEl);

  const isFilled = !!entry;
  if (isFilled) {
    const dot = document.createElement("div");
    dot.className = "diary-mini-page-dot";
    card.appendChild(dot);

    if (entry.note) {
      const noteEl = document.createElement("div");
      noteEl.className = "diary-mini-note";
      noteEl.textContent = entry.note;
      card.appendChild(noteEl);
    }
    if (entry.photoUrl) card.appendChild(buildPhotoEl(entry.photoUrl));
  } else {
    card.classList.add("empty");
    card.appendChild(buildEmptyLines());
  }
}

export async function loadDiaryTab(yearMonth, container, user) {
  if (!container || !user) return;
  container.innerHTML = "";

  // Abort any previous tab's save listener before wiring up the new one.
  if (_saveListenerCtrl) _saveListenerCtrl.abort();
  _saveListenerCtrl = new AbortController();

  const [year, month] = yearMonth.split("-").map(Number);
  const monthName = new Date(year, month - 1, 1).toLocaleString("default", { month: "long" });
  const isCurrentMonth = yearMonth === getCurrentYearMonth();
  const todayDate = new Date().getDate();
  const daysInMonth = getDaysInMonth(yearMonth);
  const maxDays = isCurrentMonth ? todayDate : daysInMonth;

  const [savedCover, monthCover, diaryDays] = await Promise.all([
    getDiaryCover(user.uid),
    getMonthCover(user.uid, yearMonth),
    getDiaryDays(user.uid, yearMonth)
  ]);
  const cover = getActiveCover(monthCover, savedCover) || DEFAULT_DIARY_COVER;

  // Live state. Mutated as entries are saved so click handlers (which
  // close over diaryDays) and the surgical updater stay in sync.
  const state = {
    cover,
    diaryDays,
    monthName,
    year,
    maxDays,
    pageCards: new Map(),
    heroSub: null,
    fillLabel: null,
    fillBar: null,
    fillPct: null,
    notebookStat: null,
  };

  function attachCardClick(card, day) {
    card.addEventListener("click", () => {
      if (isMobileWidth()) {
        openMobileDiarySheet(user.uid, yearMonth, state.diaryDays, state.cover, day);
      } else {
        openDiaryModal(user.uid, yearMonth, state.diaryDays, state.cover, day);
      }
    });
  }

  // ── SECTION 1: HERO ─────────────────────────────────────
  const hero = document.createElement("div");
  hero.className = "diary-tab-hero";

  const notebookWrap = document.createElement("div");
  notebookWrap.className = "diary-tab-notebook-wrap";
  const nb = await renderDiaryNotebook(user.uid, yearMonth, cover);
  notebookWrap.appendChild(nb);
  hero.appendChild(notebookWrap);
  state.notebookStat = notebookWrap.querySelector(".diary-nb-stat strong");

  const heroText = document.createElement("div");
  heroText.className = "diary-tab-hero-text";

  const heroTitle = document.createElement("div");
  heroTitle.className = "diary-tab-hero-title";
  heroTitle.textContent = "your diary.";
  heroText.appendChild(heroTitle);

  state.heroSub = document.createElement("div");
  state.heroSub.className = "diary-tab-hero-sub";
  heroText.appendChild(state.heroSub);

  const heroBtn = document.createElement("button");
  heroBtn.type = "button";
  heroBtn.className = "diary-tab-hero-btn";
  heroBtn.innerHTML = "✏️ write today's page";
  heroBtn.addEventListener("click", () => {
    const day = isCurrentMonth ? todayDate : maxDays;
    if (isMobileWidth()) {
      openMobileDiarySheet(user.uid, yearMonth, state.diaryDays, state.cover, day);
    } else {
      openDiaryModal(user.uid, yearMonth, state.diaryDays, state.cover, day);
    }
  });
  heroText.appendChild(heroBtn);

  hero.appendChild(heroText);
  container.appendChild(hero);

  // ── SECTION 2: THIS MONTH'S PAGES ───────────────────────
  const sectionHead = document.createElement("div");
  sectionHead.className = "diary-tab-section-head";
  sectionHead.innerHTML = `
    <div class="diary-tab-section-title">this month's pages</div>
    <div class="diary-tab-section-meta">${monthName} ${year}</div>
  `;
  container.appendChild(sectionHead);

  const fillRow = document.createElement("div");
  fillRow.className = "diary-tab-fill-row";
  fillRow.innerHTML = `
    <span class="diary-tab-fill-label"></span>
    <div class="diary-tab-fill-track"><div class="diary-tab-fill-bar"></div></div>
    <span class="diary-tab-fill-pct"></span>
  `;
  state.fillLabel = fillRow.querySelector(".diary-tab-fill-label");
  state.fillBar = fillRow.querySelector(".diary-tab-fill-bar");
  state.fillPct = fillRow.querySelector(".diary-tab-fill-pct");
  container.appendChild(fillRow);

  function updateCounts() {
    const filledCount = state.diaryDays.size;
    state.fillLabel.textContent = `${filledCount} of ${maxDays}`;
    const pctVal = maxDays > 0 ? (filledCount / maxDays) * 100 : 0;
    state.fillBar.style.width = `${pctVal}%`;
    state.fillPct.textContent = `${Math.round(pctVal)}%`;
    state.heroSub.textContent = filledCount === 0
      ? "no pages yet. start writing."
      : `${monthName} ${year}: ${filledCount} pages filled so far. keep going.`;
    if (state.notebookStat) state.notebookStat.textContent = String(filledCount);
  }
  updateCounts();

  const grid = document.createElement("div");
  grid.className = "diary-tab-pages-grid";
  container.appendChild(grid);

  const filledList = Array.from(diaryDays).sort((a, b) => a - b);
  await Promise.all(filledList.map(d => _getEntry(user.uid, yearMonth, d)));

  let staggerIdx = 0;
  for (let d = 1; d <= maxDays; d++) {
    const card = document.createElement("div");
    card.className = "diary-mini-page";
    const isToday = isCurrentMonth && d === todayDate;
    const entry = diaryDays.has(d) ? _entryCache.get(_cacheKey(user.uid, yearMonth, d)) : null;

    paintCard(card, d, entry, isToday);
    attachCardClick(card, d);
    state.pageCards.set(d, card);

    if (entry) {
      card.style.opacity = "0";
      grid.appendChild(card);
      const delay = Math.min(staggerIdx * 25, 200);
      setTimeout(() => { card.style.opacity = "1"; }, delay);
      staggerIdx++;
    } else {
      grid.appendChild(card);
    }
  }

  // ── SECTION 3: BOOKSHELF PLACEHOLDER ────────────────────
  const bookshelfSection = document.createElement("div");
  bookshelfSection.id = "diary-bookshelf-section";
  container.appendChild(bookshelfSection);

  // ── SAVE LISTENER ───────────────────────────────────────
  // Surgically refresh the affected card (and the count widgets) when a
  // diary entry is saved for this user + month. Gated on the tab being
  // visible so mylog's save flow — which intentionally reopens the diary
  // modal — isn't disrupted when the user saves from there.
  window.addEventListener("diary:saved", async (e) => {
    const d = e.detail || {};
    if (d.userId !== user.uid || d.yearMonth !== yearMonth) return;
    if (container.style.display === "none") return;
    if (d.day < 1 || d.day > maxDays) return;

    suppressOverlayReopens();

    _entryCache.delete(_cacheKey(user.uid, yearMonth, d.day));
    const entry = await _getEntry(user.uid, yearMonth, d.day);
    const wasFilled = state.diaryDays.has(d.day);
    if (entry) state.diaryDays.add(d.day);

    const card = state.pageCards.get(d.day);
    if (card) {
      const isToday = isCurrentMonth && d.day === todayDate;
      paintCard(card, d.day, entry, isToday);
      card.style.opacity = "1";
      if (!wasFilled) {
        // Gentle pulse so the user sees the new card register.
        card.style.transition = "transform 0.25s cubic-bezier(0.22,1,0.36,1)";
        card.style.transform = "scale(1.06)";
        setTimeout(() => { card.style.transform = ""; }, 250);
      }
    }
    updateCounts();
  }, { signal: _saveListenerCtrl.signal });
}
