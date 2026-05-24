import { getDiaryDays, getDiaryEntry, getDiaryCover, getMonthCover, getActiveCover } from "./diary.js";
import { renderDiaryNotebook, openDiaryModal } from "./tracker-diary.js";
import { openMobileDiarySheet } from "./diary-mobile.js";
import { DEFAULT_DIARY_COVER } from "./diary-covers.js";
import { getCurrentYearMonth, getDaysInMonth } from "./utils.js";

// Mirror of the diary entry cache in tracker-diary.js so the pages grid
// can read entry previews without re-fetching when re-rendering the tab.
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

export async function loadDiaryTab(yearMonth, container, user) {
  if (!container || !user) return;
  container.innerHTML = "";

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
  const filledCount = diaryDays.size;

  // ── SECTION 1: HERO ─────────────────────────────────────
  const hero = document.createElement("div");
  hero.className = "diary-tab-hero";

  const notebookWrap = document.createElement("div");
  notebookWrap.className = "diary-tab-notebook-wrap";
  const nb = await renderDiaryNotebook(user.uid, yearMonth, cover);
  notebookWrap.appendChild(nb);
  hero.appendChild(notebookWrap);

  const heroText = document.createElement("div");
  heroText.className = "diary-tab-hero-text";

  const heroTitle = document.createElement("div");
  heroTitle.className = "diary-tab-hero-title";
  heroTitle.textContent = "your diary.";
  heroText.appendChild(heroTitle);

  const heroSub = document.createElement("div");
  heroSub.className = "diary-tab-hero-sub";
  heroSub.textContent = filledCount === 0
    ? "no pages yet. start writing."
    : `${monthName} ${year} — ${filledCount} pages filled so far. keep going.`;
  heroText.appendChild(heroSub);

  const heroBtn = document.createElement("button");
  heroBtn.type = "button";
  heroBtn.className = "diary-tab-hero-btn";
  heroBtn.innerHTML = "✏️ write today's page";
  heroBtn.addEventListener("click", () => {
    const day = isCurrentMonth ? todayDate : maxDays;
    if (isMobileWidth()) {
      openMobileDiarySheet(user.uid, yearMonth, diaryDays, cover, day);
    } else {
      openDiaryModal(user.uid, yearMonth, diaryDays, cover, day);
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
  const pct = maxDays > 0 ? Math.round((filledCount / maxDays) * 100) : 0;
  fillRow.innerHTML = `
    <span class="diary-tab-fill-label">${filledCount} of ${maxDays}</span>
    <div class="diary-tab-fill-track"><div class="diary-tab-fill-bar" style="width:${maxDays > 0 ? (filledCount / maxDays) * 100 : 0}%"></div></div>
    <span class="diary-tab-fill-pct">${pct}%</span>
  `;
  container.appendChild(fillRow);

  const grid = document.createElement("div");
  grid.className = "diary-tab-pages-grid";
  container.appendChild(grid);

  // Render pages: 1 through today (no future). Use existing diary-mini-page class family.
  const filledList = Array.from(diaryDays).sort((a, b) => a - b);
  await Promise.all(filledList.map(d => _getEntry(user.uid, yearMonth, d)));

  let staggerIdx = 0;
  for (let d = 1; d <= maxDays; d++) {
    const mini = document.createElement("div");
    mini.className = "diary-mini-page";
    const isFilled = diaryDays.has(d);
    if (!isFilled) mini.classList.add("empty");
    if (isCurrentMonth && d === todayDate) mini.classList.add("today");

    const dayEl = document.createElement("div");
    dayEl.className = "diary-mini-day";
    dayEl.textContent = String(d);
    mini.appendChild(dayEl);

    if (isFilled) {
      const dot = document.createElement("div");
      dot.className = "diary-mini-page-dot";
      mini.appendChild(dot);

      const entry = _entryCache.get(_cacheKey(user.uid, yearMonth, d));
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

      const dayToOpen = d;
      mini.addEventListener("click", () => {
        if (isMobileWidth()) {
          openMobileDiarySheet(user.uid, yearMonth, diaryDays, cover, dayToOpen);
        } else {
          openDiaryModal(user.uid, yearMonth, diaryDays, cover, dayToOpen);
        }
      });

      mini.style.opacity = "0";
      grid.appendChild(mini);
      const delay = Math.min(staggerIdx * 25, 200);
      setTimeout(() => { mini.style.opacity = "1"; }, delay);
      staggerIdx++;
    } else {
      const lines = document.createElement("div");
      lines.className = "diary-mini-lines";
      for (let i = 0; i < 3; i++) {
        const line = document.createElement("div");
        line.className = "diary-mini-line";
        lines.appendChild(line);
      }
      mini.appendChild(lines);
      grid.appendChild(mini);
    }
  }

  // ── SECTION 3: BOOKSHELF PLACEHOLDER ────────────────────
  const bookshelfSection = document.createElement("div");
  bookshelfSection.id = "diary-bookshelf-section";
  container.appendChild(bookshelfSection);
}
