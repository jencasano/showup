import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getCurrentYearMonth, getPrevYearMonth, formatYearMonth, getFontColorSuggestions } from "./utils.js";
import { icon } from "./icons.js";

const FONTS = [
  { value: "Inter", label: "Aa — Clean" },
  { value: "Caveat", label: "Aa — Handwritten" },
  { value: "Fredoka One", label: "Aa — Chunky" },
  { value: "Playfair Display", label: "Aa — Elegant" }
];

const COLORS = ["#FF6B6B","#FF9F43","#FECA57","#48DBFB","#1DD1A1","#A29BFE","#FD79A8","#636E72"];
const STICKERS = [
  "sunflower2",
  "muscle",
  "star",
  "run",
  "brain",
  "bacon",
  "steak",
  "butter",
  "sprout",
  "boom",
  "headphones",
  "dumbbell",
  "flame",
  "target"
];
const MARKERS = [
  { value: "circle",   symbol: "●" },
  { value: "star",     symbol: "★" },
  { value: "heart",    symbol: "♥" },
  { value: "check",    symbol: "✓" },
  { value: "x",        symbol: "✗" },
  { value: "scribble", symbol: "〰" }
];

const CADENCE_OPTIONS = [
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
  { value: 3, label: "3×" },
  { value: 4, label: "4×" },
  { value: 5, label: "5×" },
  { value: 6, label: "6×" },
  { value: 7, label: "Daily" }
];

export function showMonthSetup(userId, avatarUrl, prevData = null) {
  return new Promise((resolve) => {
    const yearMonth = getCurrentYearMonth();

    const state = {
      color:      prevData?.decoration?.color     || "#FF6B6B",
      fontColor:  prevData?.decoration?.fontColor || "#FFFFFF",
      font:       prevData?.decoration?.font      || "Inter",
      sticker:    prevData?.decoration?.sticker   || "sunflower2",
      marker:     prevData?.decoration?.marker    || "circle",
      activities: prevData?.activities            || [],
      cadences:   prevData?.cadences              || []
    };

    let currentStep = 1;

    const overlay = document.createElement("div");
    overlay.id = "month-setup-overlay";
    overlay.innerHTML = buildModalHTML(yearMonth, state);
    document.body.appendChild(overlay);

    renderFontColorSwatches(state.color, state.fontColor);
    updatePreview(state);
    showStep(1);

    // ── Step navigation ──────────────────────────────────
    function showStep(step) {
      currentStep = step;
      document.getElementById("ms-step-1").style.display = step === 1 ? "block" : "none";
      document.getElementById("ms-step-2").style.display = step === 2 ? "block" : "none";
      document.getElementById("ms-back-btn").style.display = step === 1 ? "none" : "inline-block";
      document.getElementById("ms-next-btn").style.display = step === 1 ? "inline-block" : "none";
      document.getElementById("ms-save-btn").style.display = step === 2 ? "inline-block" : "none";
      document.getElementById("ms-step-label").textContent = `Step ${step} of 2`;
      document.getElementById("ms-progress-fill").style.width = `${step / 2 * 100}%`;
    }

    document.getElementById("ms-next-btn").addEventListener("click", () => showStep(2));
    document.getElementById("ms-back-btn").addEventListener("click", () => showStep(1));

    // ── Color swatches ───────────────────────────────────
    overlay.querySelectorAll(".ms-color-swatch").forEach(el => {
      el.addEventListener("click", () => {
        overlay.querySelectorAll(".ms-color-swatch").forEach(x => x.classList.remove("selected"));
        el.classList.add("selected");
        state.color = el.dataset.color;
        renderFontColorSwatches(state.color, state.fontColor);
        updatePreview(state);
      });
    });

    // ── Font options ─────────────────────────────────────
    overlay.querySelectorAll(".ms-font-option").forEach(el => {
      el.addEventListener("click", () => {
        overlay.querySelectorAll(".ms-font-option").forEach(x => x.classList.remove("selected"));
        el.classList.add("selected");
        state.font = el.dataset.font;
        updatePreview(state);
      });
    });

    // ── Sticker options ──────────────────────────────────
    overlay.querySelectorAll(".ms-sticker-option").forEach(el => {
      el.addEventListener("click", () => {
        overlay.querySelectorAll(".ms-sticker-option").forEach(x => x.classList.remove("selected"));
        el.classList.add("selected");
        state.sticker = el.dataset.sticker;
        updatePreview(state);
      });
    });

    // ── Marker options ───────────────────────────────────
    overlay.querySelectorAll(".ms-marker-option").forEach(el => {
      el.addEventListener("click", () => {
        overlay.querySelectorAll(".ms-marker-option").forEach(x => x.classList.remove("selected"));
        el.classList.add("selected");
        state.marker = el.dataset.marker;
      });
    });

    // ── Add activity ─────────────────────────────────────
    let activityCount = state.activities.length || 1;

    function syncActivitiesFromUI() {
      const rows = document.querySelectorAll(".ms-activity-row");
      state.activities = Array.from(rows, row =>
        row.querySelector(".ms-activity-input")?.value || ""
      );
      state.cadences = Array.from(rows, row => {
        const selectedBtn = row.querySelector(".ms-cadence-btn.selected");
        return selectedBtn ? parseInt(selectedBtn.dataset.value) : null;
      });
    }

    function renderActivityRows() {
      const list = document.getElementById("ms-activities-list");
      list.innerHTML = "";

      const count = Math.max(activityCount, 1);
      for (let i = 0; i < count; i++) {
        const existingName = state.activities[i] || "";
        const existingCad  = i < state.cadences.length ? state.cadences[i] : 7;
        list.appendChild(buildActivityRow(i + 1, existingName, existingCad));
      }

      document.getElementById("ms-add-activity-btn").style.display =
        activityCount >= 5 ? "none" : "";
    }

    function buildActivityRow(num, nameVal, cadVal) {
      const wrap = document.createElement("div");
      wrap.className = "ms-activity-row";

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "activity-input ms-activity-input";
      nameInput.placeholder = `Activity ${num}${num === 1 ? " (e.g. workout)" : " (optional)"}`;
      nameInput.maxLength = 20;
      nameInput.value = nameVal;

      const cadLabel = document.createElement("div");
      cadLabel.className = "ms-cadence-label";
      cadLabel.textContent = "How many times a week?";

      const cadPicker = document.createElement("div");
      cadPicker.className = "ms-cadence-picker";

      CADENCE_OPTIONS.forEach(opt => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ms-cadence-btn" + (opt.value === cadVal ? " selected" : "");
        btn.dataset.value = opt.value;
        btn.textContent = opt.label;
        btn.addEventListener("click", () => {
          const isAlreadySelected = btn.classList.contains("selected");
          cadPicker.querySelectorAll(".ms-cadence-btn").forEach(b => b.classList.remove("selected"));
          if (!isAlreadySelected) {
            btn.classList.add("selected");
          }
        });
        cadPicker.appendChild(btn);
      });

      wrap.appendChild(nameInput);
      wrap.appendChild(cadLabel);
      wrap.appendChild(cadPicker);
      return wrap;
    }

    renderActivityRows();

    document.getElementById("ms-add-activity-btn").addEventListener("click", () => {
      if (activityCount >= 5) return;
      syncActivitiesFromUI();
      activityCount++;
      renderActivityRows();
    });

    // ── Save ─────────────────────────────────────────────
    document.getElementById("ms-save-btn").addEventListener("click", async () => {
      const rows = document.querySelectorAll(".ms-activity-row");
      const activities = [];
      const cadences   = [];

      rows.forEach(row => {
        const name = row.querySelector(".ms-activity-input")?.value.trim();
        const cadBtn = row.querySelector(".ms-cadence-btn.selected");
        const cad  = cadBtn ? parseInt(cadBtn.dataset.value) : 7;
        if (name) {
          activities.push(name);
          cadences.push(cad);
        }
      });

      if (activities.length === 0) {
        alert("Please add at least one activity!");
        return;
      }

      const btn = document.getElementById("ms-save-btn");
      btn.textContent = "Saving...";
      btn.disabled = true;

      try {
        // Fetch the user's profile to embed denormalized identity fields
        // into the log entry. This removes the need for a users/ lookup
        // when other users load the All tab.
        const userSnap = await getDoc(doc(db, "users", userId));
        const userData = userSnap.exists() ? userSnap.data() : {};

        const entryData = {
          userId,
          yearMonth,
          // ── Denormalized identity fields ──────────────────
          // Stored here so the All tab can render cards without
          // an extra round-trip to the users/ collection.
          displayName: userData.displayName || "",
          username:    userData.username    || userData.displayName || "",
          // ─────────────────────────────────────────────────
          activities,
          cadences,
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

    // ── Font color swatch renderer ────────────────────────
    function renderFontColorSwatches(badgeColor, currentFontColor) {
      const suggestions = getFontColorSuggestions(badgeColor);
      if (!suggestions.includes(currentFontColor)) {
        state.fontColor = suggestions[0];
      }
      const container = document.getElementById("ms-font-color-options");
      container.innerHTML = suggestions.map(c => `
        <div class="ms-font-color-swatch ${state.fontColor === c ? "selected" : ""}"
          data-color="${c}"
          style="background:${c}; border: 2px solid ${c === "#FFFFFF" ? "#ddd" : c};">
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

// ── Preview updater ───────────────────────────────────────
function updatePreview(state) {
  const badge = document.getElementById("ms-badge-preview");
  if (!badge) return;
  badge.style.background = state.color;
  badge.style.fontFamily = `'${state.font}', sans-serif`;
  badge.style.color = state.fontColor;
  badge.innerHTML = `<span>Your Name</span>${icon(state.sticker, 22, "ms-preview-sticker")}`;
}

// ── Modal HTML builder ────────────────────────────────────
function buildModalHTML(yearMonth, state) {
  return `
  <div id="month-setup-modal">

    <div id="ms-progress-bar"><div id="ms-progress-fill"></div></div>
    <div id="ms-step-label">Step 1 of 2</div>

    <!-- STEP 1: Decoration -->
    <div id="ms-step-1">
      <h2>Make it yours.</h2>
      <p>Customize your section for <strong>${formatYearMonth(yearMonth)}</strong>.</p>

      <div class="ms-step1-grid">
        <div class="ms-step1-col">
          <div class="ms-section-label">Badge Color</div>
          <div id="ms-color-options">
            ${COLORS.map(c => `
              <div class="ms-color-swatch ${state.color === c ? "selected" : ""}"
                data-color="${c}" style="background:${c};"></div>
            `).join("")}
          </div>

          <div class="ms-section-label">Font Color</div>
          <div id="ms-font-color-options"></div>

          <div class="ms-section-label">Sticker</div>
          <div id="ms-sticker-options">
            ${STICKERS.map(s => `
              <div class="ms-sticker-option ${state.sticker === s ? "selected" : ""}"
                data-sticker="${s}">${icon(s, 24, "ms-sticker-icon")}</div>
            `).join("")}
          </div>

          <div class="ms-section-label">Marker</div>
          <div id="ms-marker-options">
            ${MARKERS.map(m => `
              <div class="ms-marker-option ${state.marker === m.value ? "selected" : ""}"
                data-marker="${m.value}">${m.symbol}</div>
            `).join("")}
          </div>
        </div>

        <div class="ms-step1-col">
          <div class="ms-section-label">Font</div>
          <div id="ms-font-options">
            ${FONTS.map(f => `
              <div class="ms-font-option ${state.font === f.value ? "selected" : ""}"
                data-font="${f.value}">
                <span style="font-family:'${f.value}';">${f.label}</span>
              </div>
            `).join("")}
          </div>

          <div class="ms-section-label">Preview</div>
          <div id="ms-badge-preview"
            style="background:${state.color}; font-family:'${state.font}'; color:${state.fontColor};">
            <span>Your Name</span>
            ${icon(state.sticker, 22, "ms-preview-sticker")}
          </div>
        </div>
      </div>
    </div>

    <!-- STEP 2: Activities + Cadence -->
    <div id="ms-step-2">
      <h2>What are you tracking?</h2>
      <p>Add up to 5 activities for <strong>${formatYearMonth(yearMonth)}</strong>.<br>
         Set how often per week you plan to do each one.</p>

      <div id="ms-activities-list"></div>

      <button id="ms-add-activity-btn"
        ${state.activities.length >= 5 ? 'style="display:none;"' : ""}>
        + Add another
      </button>
    </div>

    <!-- NAVIGATION -->
    <div id="ms-nav">
      <button id="ms-back-btn" style="display:none;">← Back</button>
      <button id="ms-next-btn">Next →</button>
      <button id="ms-save-btn" style="display:none;">Save & Start Tracking →</button>
    </div>

  </div>`;
}

// ── Check if monthly setup needed ────────────────────────
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
