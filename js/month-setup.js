import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getCurrentYearMonth, getPrevYearMonth, formatYearMonth, getFontColorSuggestions } from "./utils.js";

const FONTS = [
  { value: "Inter", label: "Aa — Clean" },
  { value: "Caveat", label: "Aa — Handwritten" },
  { value: "Fredoka One", label: "Aa — Chunky" },
  { value: "Playfair Display", label: "Aa — Elegant" }
];

const COLORS = ["#FF6B6B","#FF9F43","#FECA57","#48DBFB","#1DD1A1","#A29BFE","#FD79A8","#636E72"];
const STICKERS = ["🌻","💪","🔥","⭐","🎯","🌈","🦋","🌸","⚡","🍀"];
const MARKERS = [
  { value: "circle", symbol: "●" },
  { value: "star",   symbol: "★" },
  { value: "heart",  symbol: "♥" },
  { value: "check",  symbol: "✓" },
  { value: "x",      symbol: "✗" },
  { value: "scribble", symbol: "〰" }
];

export function showMonthSetup(userId, avatarUrl, prevData = null) {
  return new Promise((resolve) => {
    const yearMonth = getCurrentYearMonth();

    // State — preload from previous month or use defaults
    const state = {
      color:     prevData?.decoration?.color     || "#FF6B6B",
      fontColor: prevData?.decoration?.fontColor || "#FFFFFF",
      font:      prevData?.decoration?.font      || "Inter",
      sticker:   prevData?.decoration?.sticker   || "🌻",
      marker:    prevData?.decoration?.marker    || "circle",
      activities: prevData?.activities           || []
    };

    const overlay = document.createElement("div");
    overlay.id = "month-setup-overlay";
    overlay.innerHTML = buildModalHTML(yearMonth, state);
    document.body.appendChild(overlay);

    // Init font color swatches based on default color
    renderFontColorSwatches(state.color, state.fontColor);
    updatePreview(state);

    // ── Color swatches ──────────────────────────────────
    overlay.querySelectorAll(".ms-color-swatch").forEach(el => {
      el.addEventListener("click", () => {
        overlay.querySelectorAll(".ms-color-swatch").forEach(x => x.classList.remove("selected"));
        el.classList.add("selected");
        state.color = el.dataset.color;
        renderFontColorSwatches(state.color, state.fontColor);
        updatePreview(state);
      });
    });

    // ── Font options ────────────────────────────────────
    overlay.querySelectorAll(".ms-font-option").forEach(el => {
      el.addEventListener("click", () => {
        overlay.querySelectorAll(".ms-font-option").forEach(x => x.classList.remove("selected"));
        el.classList.add("selected");
        state.font = el.dataset.font;
        updatePreview(state);
      });
    });

    // ── Sticker options ─────────────────────────────────
    overlay.querySelectorAll(".ms-sticker-option").forEach(el => {
      el.addEventListener("click", () => {
        overlay.querySelectorAll(".ms-sticker-option").forEach(x => x.classList.remove("selected"));
        el.classList.add("selected");
        state.sticker = el.dataset.sticker;
        updatePreview(state);
      });
    });

    // ── Marker options ──────────────────────────────────
    overlay.querySelectorAll(".ms-marker-option").forEach(el => {
      el.addEventListener("click", () => {
        overlay.querySelectorAll(".ms-marker-option").forEach(x => x.classList.remove("selected"));
        el.classList.add("selected");
        state.marker = el.dataset.marker;
      });
    });

    // ── Add activity ────────────────────────────────────
    let activityCount = state.activities.length || 1;
    document.getElementById("ms-add-activity-btn").addEventListener("click", () => {
      if (activityCount >= 5) return;
      activityCount++;
      const input = document.createElement("input");
      input.type = "text";
      input.className = "activity-input ms-activity-input";
      input.placeholder = `Activity ${activityCount} (optional)`;
      input.maxLength = 20;
      document.getElementById("ms-activities-list").appendChild(input);
      if (activityCount === 5) {
        document.getElementById("ms-add-activity-btn").style.display = "none";
      }
    });

    // ── Save ────────────────────────────────────────────
    document.getElementById("ms-save-btn").addEventListener("click", async () => {
      const inputs = document.querySelectorAll(".ms-activity-input");
      const activities = Array.from(inputs)
        .map(i => i.value.trim())
        .filter(v => v !== "");

      if (activities.length === 0) {
        alert("Please add at least one activity!");
        return;
      }

      const btn = document.getElementById("ms-save-btn");
      btn.textContent = "Saving...";
      btn.disabled = true;

      try {
        const entryData = {
          userId,
          yearMonth,
          activities,
          marks: {},
          decoration: {
            color:     state.color,
            fontColor: state.fontColor,
            font:      state.font,
            sticker:   state.sticker,
            marker:    state.marker,
            avatarUrl: avatarUrl || ""
          }
        };

        await setDoc(
          doc(db, "logs", yearMonth, "entries", userId),
          entryData,
          { merge: true }
        );

        overlay.remove();
        resolve(entryData);
      } catch (error) {
        console.error("Error saving monthly setup:", error);
        alert("Something went wrong. Please try again.");
        btn.textContent = "Save & Start Tracking →";
        btn.disabled = false;
      }
    });

    // ── Font color swatch renderer ───────────────────────
    function renderFontColorSwatches(badgeColor, currentFontColor) {
      const suggestions = getFontColorSuggestions(badgeColor);
      // Auto-select first suggestion if current font color not in new suggestions
      if (!suggestions.includes(currentFontColor)) {
        state.fontColor = suggestions[0];
      }
      const container = document.getElementById("ms-font-color-options");
      container.innerHTML = suggestions.map(c => `
        <div class="ms-font-color-swatch ${state.fontColor === c ? 'selected' : ''}"
          data-color="${c}"
          style="background:${c}; border: 2px solid ${c === '#FFFFFF' ? '#ddd' : c};">
        </div>
      `).join("");

      container.querySelectorAll(".ms-font-color-swatch").forEach(el => {
        el.addEventListener("click", () => {
          container.querySelectorAll(".ms-font-color-swatch").forEach(x => x.classList.remove("selected"));
          el.classList.add("selected");
          state.fontColor = el.dataset.color;
          updatePreview(state);
        });
      });
    }
  });
}

// ── Preview updater ──────────────────────────────────────
function updatePreview(state) {
  const badge = document.getElementById("ms-badge-preview");
  if (!badge) return;
  badge.style.background = state.color;
  badge.style.fontFamily = `'${state.font}', sans-serif`;
  badge.style.color = state.fontColor;
}

// ── Modal HTML builder ───────────────────────────────────
function buildModalHTML(yearMonth, state) {
  return `
  <div id="month-setup-modal">
    <h2>Set up your tracker</h2>
    <p>Customize your section for <strong>${formatYearMonth(yearMonth)}</strong>.</p>

    <div class="ms-section-label">Badge Color</div>
    <div id="ms-color-options">
      ${COLORS.map(c => `
        <div class="ms-color-swatch ${state.color === c ? 'selected' : ''}"
          data-color="${c}" style="background:${c};"></div>
      `).join("")}
    </div>

    <div class="ms-section-label">Font Color</div>
    <div id="ms-font-color-options"></div>

    <div class="ms-section-label">Font</div>
    <div id="ms-font-options">
      ${FONTS.map(f => `
        <div class="ms-font-option ${state.font === f.value ? 'selected' : ''}"
          data-font="${f.value}">
          <span style="font-family:'${f.value}';">${f.label}</span>
        </div>
      `).join("")}
    </div>

    <div class="ms-section-label">Sticker</div>
    <div id="ms-sticker-options">
      ${STICKERS.map(s => `
        <div class="ms-sticker-option ${state.sticker === s ? 'selected' : ''}"
          data-sticker="${s}">${s}</div>
      `).join("")}
    </div>

    <div class="ms-section-label">Marker</div>
    <div id="ms-marker-options">
      ${MARKERS.map(m => `
        <div class="ms-marker-option ${state.marker === m.value ? 'selected' : ''}"
          data-marker="${m.value}">${m.symbol}</div>
      `).join("")}
    </div>

    <div class="ms-section-label">Preview</div>
    <div id="ms-badge-preview"
      style="background:${state.color}; font-family:'${state.font}'; color:${state.fontColor};">
      <span>🌻</span>
      <span>Your Name</span>
    </div>

    <div class="ms-section-label">Activities for ${formatYearMonth(yearMonth)}</div>
    <div id="ms-activities-list">
      ${state.activities.length > 0
        ? state.activities.map((a, i) => `
            <input type="text" class="activity-input ms-activity-input"
              placeholder="Activity ${i+1}" maxlength="20" value="${a}" />
          `).join("")
        : `<input type="text" class="activity-input ms-activity-input"
            placeholder="Activity 1 (e.g. workout)" maxlength="20" />`
      }
    </div>
    <button id="ms-add-activity-btn"
      ${state.activities.length >= 5 ? 'style="display:none;"' : ''}>
      + Add another
    </button>

    <button id="ms-save-btn">Save & Start Tracking →</button>
  </div>`;
}

// ── Check if monthly setup needed ───────────────────────
export async function checkMonthlySetup(userId, avatarUrl) {
  const yearMonth = getCurrentYearMonth();
  const logRef = doc(db, "logs", yearMonth, "entries", userId);
  const logSnap = await getDoc(logRef);

  if (!logSnap.exists() || !logSnap.data().activities) {
    const prevYearMonth = getPrevYearMonth(yearMonth);
    const prevRef = doc(db, "logs", prevYearMonth, "entries", userId);
    const prevSnap = await getDoc(prevRef);
    const prevData = prevSnap.exists() ? prevSnap.data() : null;

    await showMonthSetup(userId, avatarUrl, prevData);
    return true;
  }

  return false;
}