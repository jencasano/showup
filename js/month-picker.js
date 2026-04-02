// ═══════════════════════════════════════════════
//  MONTH PICKER — Phase 6
//  Popover with year sections + month grid.
//  Calls onSelect(yearMonth) when a month is picked.
// ═══════════════════════════════════════════════

import { getCurrentYearMonth } from "./utils.js";

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun",
                    "Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Build / mount the popover DOM (once) ────────
function ensurePopover() {
  if (document.getElementById("month-picker-popover")) return;

  const el = document.createElement("div");
  el.id = "month-picker-popover";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Month Picker");
  el.innerHTML = `
    <div id="month-picker-inner">
      <div id="month-picker-scroll"></div>
    </div>
  `;
  document.body.appendChild(el);

  // Close on backdrop click
  el.addEventListener("click", (e) => {
    if (e.target === el) closeMonthPicker();
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && el.classList.contains("open")) closeMonthPicker();
  });
}

// ── Generate year blocks ─────────────────────────
function buildContent(activeYearMonth, onSelect) {
  const scroll = document.getElementById("month-picker-scroll");
  if (!scroll) return;

  const currentYM = getCurrentYearMonth();
  const [curYear, curMonth] = currentYM.split("-").map(Number);
  const [activeYear, activeMonth] = activeYearMonth.split("-").map(Number);

  // Show years from current back 5 years (or to the start), future months greyed
  const startYear = curYear - 4;
  const years = [];
  for (let y = curYear; y >= startYear; y--) years.push(y);

  scroll.innerHTML = "";

  years.forEach(year => {
    // Only show months up to current for the current year
    const maxMonth = year === curYear ? curMonth : 12;
    // Skip years that have no valid months (shouldn't happen, but guard)
    if (maxMonth < 1) return;

    const section = document.createElement("div");
    section.className = "mp-year-section";

    const heading = document.createElement("div");
    heading.className = "mp-year-label";
    heading.textContent = year;
    section.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "mp-month-grid";

    MONTH_ABBR.forEach((abbr, idx) => {
      const monthNum = idx + 1;
      const ym = `${year}-${String(monthNum).padStart(2, "0")}`;
      const btn = document.createElement("button");
      btn.className = "mp-month-btn";
      btn.textContent = abbr;

      const isFuture = monthNum > maxMonth;
      const isActive = (year === activeYear && monthNum === activeMonth);

      if (isFuture) {
        btn.disabled = true;
        btn.classList.add("mp-disabled");
      } else if (isActive) {
        btn.classList.add("mp-active");
      }

      btn.addEventListener("click", () => {
        onSelect(ym);
        closeMonthPicker();
      });

      grid.appendChild(btn);
    });

    section.appendChild(grid);
    scroll.appendChild(section);
  });

  // Scroll the active month into view smoothly
  requestAnimationFrame(() => {
    const activeBtn = scroll.querySelector(".mp-active");
    if (activeBtn) {
      activeBtn.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });
}

// ── Public API ────────────────────────────────────
export function openMonthPicker(anchorEl, activeYearMonth, onSelect) {
  ensurePopover();
  buildContent(activeYearMonth, onSelect);

  const popover = document.getElementById("month-picker-popover");
  popover.classList.add("open");

  // Position below the anchor button on desktop; centered on mobile
  positionPopover(anchorEl);
}

export function closeMonthPicker() {
  const popover = document.getElementById("month-picker-popover");
  if (popover) popover.classList.remove("open");
}

export function toggleMonthPicker(anchorEl, activeYearMonth, onSelect) {
  const popover = document.getElementById("month-picker-popover");
  if (popover && popover.classList.contains("open")) {
    closeMonthPicker();
  } else {
    openMonthPicker(anchorEl, activeYearMonth, onSelect);
  }
}

// ── Positioning ───────────────────────────────────
function positionPopover(anchorEl) {
  const inner = document.getElementById("month-picker-inner");
  if (!inner || !anchorEl) return;

  // On mobile (<= 480px) we let CSS center it; skip JS positioning
  if (window.innerWidth <= 480) {
    inner.style.removeProperty("top");
    inner.style.removeProperty("left");
    return;
  }

  const rect = anchorEl.getBoundingClientRect();
  const popoverWidth = 260;
  let left = rect.left;
  let top = rect.bottom + 8;

  // Keep within viewport horizontally
  if (left + popoverWidth > window.innerWidth - 8) {
    left = window.innerWidth - popoverWidth - 8;
  }
  if (left < 8) left = 8;

  inner.style.top  = `${top}px`;
  inner.style.left = `${left}px`;
}
