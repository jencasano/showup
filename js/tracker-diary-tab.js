import { getDiaryDays, getDiaryEntry, getDiaryCover, getMonthCover, getActiveCover } from "./diary.js";
import { renderDiaryNotebook, openDiaryModal, openDiaryPagesModal } from "./tracker-diary.js";
import { openMobileDiarySheet } from "./diary-mobile.js";
import { DIARY_COVERS, DEFAULT_DIARY_COVER } from "./diary-covers.js";
import { getCurrentYearMonth, getDaysInMonth, getPrevYearMonth } from "./utils.js";

const _entryCache = new Map();
const _cacheKey = (uid, ym, d) => `${uid}/${ym}/${d}`;
async function _getEntry(uid, ym, d) {
  const k = _cacheKey(uid, ym, d);
  if (_entryCache.has(k)) return _entryCache.get(k);
  const e = await getDiaryEntry(uid, ym, d);
  _entryCache.set(k, e);
  return e;
}

// Past-month bookshelf cache. Keyed by pivot yearMonth; reset when the
// active user changes. The shelf only shows months older than the pivot,
// none of which mutate during a normal session, so this stays valid until
// the user signs out / a different account loads.
let _shelfCacheUser = null;
const _shelfCache = new Map();

function isMobileWidth() {
  return window.matchMedia("(max-width: 767px)").matches;
}

function isLightCover(coverKey) {
  const swatch = DIARY_COVERS[coverKey]?.swatch || "#000000";
  const r = parseInt(swatch.slice(1, 3), 16);
  const g = parseInt(swatch.slice(3, 5), 16);
  const b = parseInt(swatch.slice(5, 7), 16);
  return (r + g + b) / 3 > 160;
}

async function scanPastMonths(userId, pivotYearMonth, userDefaultCover) {
  const found = [];
  let ym = getPrevYearMonth(pivotYearMonth);
  let monthsTried = 0;
  let consecutiveEmpty = 0;

  while (monthsTried < 12 && consecutiveEmpty < 3) {
    const [diaryDays, monthCover] = await Promise.all([
      getDiaryDays(userId, ym),
      getMonthCover(userId, ym),
    ]);
    if (diaryDays.size > 0) {
      const [yr, mo] = ym.split("-").map(Number);
      const date = new Date(yr, mo - 1, 1);
      found.push({
        yearMonth: ym,
        diaryDays,
        cover: monthCover || userDefaultCover || DEFAULT_DIARY_COVER,
        monthLabel: `${date.toLocaleString("default", { month: "short" })} ${yr}`,
        fullLabel: `${date.toLocaleString("default", { month: "long" })} ${yr}`,
        entryCount: diaryDays.size,
        totalDays: getDaysInMonth(ym),
      });
      consecutiveEmpty = 0;
    } else {
      consecutiveEmpty++;
    }
    monthsTried++;
    ym = getPrevYearMonth(ym);
  }
  return found;
}

async function getPastMonths(userId, pivotYearMonth, userDefaultCover) {
  if (_shelfCacheUser !== userId) {
    _shelfCacheUser = userId;
    _shelfCache.clear();
  }
  if (_shelfCache.has(pivotYearMonth)) return _shelfCache.get(pivotYearMonth);
  const items = await scanPastMonths(userId, pivotYearMonth, userDefaultCover);
  _shelfCache.set(pivotYearMonth, items);
  return items;
}

function buildSpine(item, userId) {
  const spine = document.createElement("div");
  spine.className = "diary-tab-book-spine";

  if (item.entryCount >= 20)      spine.classList.add("h-tall", "w-thick");
  else if (item.entryCount >= 10) spine.classList.add("h-medium");
  else                            spine.classList.add("h-short", "w-thin");

  if (isLightCover(item.cover)) spine.classList.add("light-cover");

  const theme = DIARY_COVERS[item.cover] || DIARY_COVERS[DEFAULT_DIARY_COVER];
  spine.style.background = theme.coverGradient;

  const dots = document.createElement("div");
  dots.className = "diary-tab-spine-dots";
  for (let i = 0; i < 2; i++) {
    const dot = document.createElement("div");
    dot.className = "diary-tab-spine-dot";
    dots.appendChild(dot);
  }
  spine.appendChild(dots);

  const title = document.createElement("div");
  title.className = "diary-tab-spine-title";
  title.textContent = item.monthLabel;
  spine.appendChild(title);

  const count = document.createElement("div");
  count.className = "diary-tab-spine-count";
  count.textContent = String(item.entryCount);
  spine.appendChild(count);

  const bandBottom = document.createElement("div");
  bandBottom.className = "diary-tab-spine-band-bottom";
  spine.appendChild(bandBottom);

  const tooltip = document.createElement("div");
  tooltip.className = "diary-tab-spine-tooltip";
  tooltip.textContent = `${item.fullLabel} · ${item.entryCount} of ${item.totalDays} pages`;
  spine.appendChild(tooltip);

  spine.addEventListener("click", () => {
    openDiaryPagesModal(userId, item.yearMonth, item.diaryDays, item.cover);
  });

  return spine;
}

function renderBookshelfInto(section, items, userId) {
  section.innerHTML = "";

  const head = document.createElement("div");
  head.className = "diary-tab-section-head";
  head.innerHTML = `
    <div class="diary-tab-section-title">my bookshelf</div>
    <div class="diary-tab-section-meta">past diaries</div>
  `;
  section.appendChild(head);

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "diary-tab-bookshelf-empty";
    empty.textContent = "your bookshelf is empty. keep writing and it will fill up.";
    section.appendChild(empty);
    return;
  }

  const shelf = document.createElement("div");
  shelf.className = "diary-tab-bookshelf";

  const scroll = document.createElement("div");
  scroll.className = "diary-tab-shelf-scroll";
  const plank = document.createElement("div");
  plank.className = "diary-tab-shelf-plank";
  items.forEach(item => plank.appendChild(buildSpine(item, userId)));
  scroll.appendChild(plank);
  shelf.appendChild(scroll);

  const surface = document.createElement("div");
  surface.className = "diary-tab-shelf-surface";
  shelf.appendChild(surface);

  const label = document.createElement("div");
  label.className = "diary-tab-shelf-label";
  label.textContent = "newest ← → oldest";
  shelf.appendChild(label);

  section.appendChild(shelf);
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
  const nb = await renderDiaryNotebook(user.uid, yearMonth, cover, () => {
    // Notebook should open the variant matching the viewport: mobile
    // sheet on phones, desktop modal otherwise. state.diaryDays is the
    // live set, mutated after a save.
    if (isMobileWidth()) {
      openMobileDiarySheet(user.uid, yearMonth, state.diaryDays, state.cover);
    } else {
      openDiaryModal(user.uid, yearMonth, state.diaryDays, state.cover);
    }
  });
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

  // ── SECTION 3: BOOKSHELF ────────────────────────────────
  // Render asynchronously: the scan does Firestore reads, and the cache
  // keeps subsequent renders instant. isConnected guards against a stale
  // promise resolving after a re-render has replaced this section.
  const bookshelfSection = document.createElement("div");
  bookshelfSection.id = "diary-bookshelf-section";
  container.appendChild(bookshelfSection);
  getPastMonths(user.uid, yearMonth, savedCover).then(items => {
    if (bookshelfSection.isConnected) {
      renderBookshelfInto(bookshelfSection, items, user.uid);
    }
  });

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
