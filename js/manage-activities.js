import { db } from "./firebase-config.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast } from "./ui.js";

const ACTIVITY_COLORS = [
  "#D8584E",
  "#80B9B9",
  "#F8C08A",
  "#A29BFE",
  "#1DD1A1",
];

function getActivityColor(index) {
  return ACTIVITY_COLORS[index % ACTIVITY_COLORS.length];
}

// ─── MANAGE ACTIVITIES MODAL ──────────────────────────────
export function openManageActivitiesModal(entry, yearMonth, currentUser, onMarkToggled) {
  const [year, month] = yearMonth.split("-").map(Number);
  const monthName = new Date(year, month - 1, 1).toLocaleString("default", { month: "long" });

  const initialActivities = entry.activities || [];

  const backdrop = document.createElement("div");
  backdrop.className = "manage-activities-backdrop";

  const modal = document.createElement("div");
  modal.className = "manage-activities-modal";

  // ── Header ────────────────────────────────────────────
  const header = document.createElement("div");
  header.className = "ma-header";

  const headerLeft = document.createElement("div");
  const title = document.createElement("div");
  title.className = "ma-title";
  title.textContent = "Manage Activities";
  const subtitle = document.createElement("div");
  subtitle.className = "ma-subtitle";
  subtitle.textContent = `${monthName} ${year} · tap a name to rename`;
  headerLeft.appendChild(title);
  headerLeft.appendChild(subtitle);

  const closeBtn = document.createElement("button");
  closeBtn.className = "ma-close";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => { backdrop.remove(); modal.remove(); });

  header.appendChild(headerLeft);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // ── Activity List ─────────────────────────────────────
  const list = document.createElement("div");
  list.className = "ma-list";

  const CADENCE_OPTIONS = [
    { label: "1×", value: 1 },
    { label: "2×", value: 2 },
    { label: "3×", value: 3 },
    { label: "4×", value: 4 },
    { label: "5×", value: 5 },
    { label: "6×", value: 6 },
    { label: "Daily", value: 7 },
  ];

  function buildRow(activityName, cadenceValue, colorIndex) {
    const row = document.createElement("div");
    row.className = "ma-row";
    if (activityName) row.dataset.originalName = activityName;

    const rowTop = document.createElement("div");
    rowTop.className = "ma-row-top";

    const dot = document.createElement("div");
    dot.className = "ma-dot";
    dot.style.background = getActivityColor(colorIndex);

    const nameInput = document.createElement("input");
    nameInput.className = "ma-name-input";
    nameInput.type = "text";
    nameInput.value = activityName;
    nameInput.maxLength = 20;
    nameInput.addEventListener("focus", () => row.classList.add("is-focused"));
    nameInput.addEventListener("blur", () => row.classList.remove("is-focused"));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "ma-delete-btn";
    deleteBtn.title = "Delete activity";
    deleteBtn.textContent = "×";
    deleteBtn.addEventListener("click", () => {
      handleDelete(row);
    });

    rowTop.appendChild(dot);
    rowTop.appendChild(nameInput);
    rowTop.appendChild(deleteBtn);
    row.appendChild(rowTop);

    const cadenceRow = document.createElement("div");
    cadenceRow.className = "ma-cadence-row";

    const cadLabel = document.createElement("span");
    cadLabel.className = "ma-cadence-label";
    cadLabel.textContent = "Per week";
    cadenceRow.appendChild(cadLabel);

    CADENCE_OPTIONS.forEach(opt => {
      const btn = document.createElement("button");
      btn.className = "ma-cadence-btn";
      btn.dataset.value = opt.value;
      btn.textContent = opt.label;
      if (opt.value === cadenceValue) btn.classList.add("active");
      btn.addEventListener("click", () => {
        cadenceRow.querySelectorAll(".ma-cadence-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
      cadenceRow.appendChild(btn);
    });

    row.appendChild(cadenceRow);
    return row;
  }

  // Populate existing activities
  const cadences = entry.cadences || initialActivities.map(() => 7);
  initialActivities.forEach((act, i) => {
    list.appendChild(buildRow(act, cadences[i] ?? 7, i));
  });

  modal.appendChild(list);

  // ── Add Button ────────────────────────────────────────
  const addBtn = document.createElement("button");
  addBtn.className = "ma-add-btn";
  addBtn.textContent = "+ Add another activity";
  if (initialActivities.length >= 5) addBtn.style.display = "none";

  addBtn.addEventListener("click", () => {
    const newIndex = list.children.length;
    const row = buildRow("", 7, newIndex);
    list.appendChild(row);
    row.querySelector(".ma-name-input").focus();
    if (list.children.length >= 5) addBtn.style.display = "none";
  });

  modal.appendChild(addBtn);

  // ── Footer ────────────────────────────────────────────
  const footer = document.createElement("div");
  footer.className = "ma-footer";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "ma-btn ma-btn--ghost";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => { backdrop.remove(); modal.remove(); });

  const saveBtn = document.createElement("button");
  saveBtn.className = "ma-btn ma-btn--save";
  saveBtn.textContent = "Save changes";
  saveBtn.addEventListener("click", handleSave);

  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);
  modal.appendChild(footer);

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) { backdrop.remove(); modal.remove(); }
  });

  // ── handleDelete ──────────────────────────────────────
  function handleDelete(row) {
    const activityName = row.querySelector(".ma-name-input")?.value.trim() || "";
    const loggedCount = (entry.marks?.[activityName] || []).length;

    showDeleteConfirmModal(activityName || "this activity", loggedCount, () => {
      row.remove();
      if (list.children.length < 5) addBtn.style.display = "";
    });
  }

  // ── handleSave ───────────────────────────────────────
  async function handleSave() {
    const rows = [...list.children];
    const newActivities = [];
    const newCadences = [];
    const originalNames = []; // parallel to newActivities

    rows.forEach(row => {
      const nameVal = row.querySelector(".ma-name-input")?.value.trim();
      if (!nameVal) return;
      const activeBtn = row.querySelector(".ma-cadence-btn.active");
      const cad = activeBtn ? parseInt(activeBtn.dataset.value, 10) : 7;
      newActivities.push(nameVal);
      newCadences.push(cad);
      originalNames.push(row.dataset.originalName || null);
    });

    if (newActivities.length === 0) {
      showToast("You need at least one activity.", "error");
      return;
    }

    // Build new marks: carry over by original name → new name mapping
    const oldMarks = entry.marks || {};
    const newMarks = {};

    newActivities.forEach((newName, i) => {
      const originalName = originalNames[i];
      if (originalName && oldMarks[originalName]) {
        newMarks[newName] = oldMarks[originalName];
      } else {
        newMarks[newName] = [];
      }
    });

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    try {
      const logRef = doc(db, "logs", yearMonth, "entries", currentUser.uid);
      await setDoc(logRef, {
        activities: newActivities,
        cadences: newCadences,
        marks: newMarks,
      }, { merge: true });

      // Update in-memory entry for immediate re-render
      entry.activities = newActivities;
      entry.cadences = newCadences;
      entry.marks = newMarks;

      onMarkToggled(entry);
      backdrop.remove();
      modal.remove();
      showToast("Activities updated.", "info");
    } catch (err) {
      console.error("Save activities error:", err);
      showToast("Couldn't save. Try again.", "error");
      saveBtn.disabled = false;
      saveBtn.textContent = "Save changes";
    }
  }
}

// ─── DELETE CONFIRM MODAL ─────────────────────────────────
export function showDeleteConfirmModal(activityName, loggedCount, onConfirm) {
  const backdrop = document.createElement("div");
  backdrop.className = "confirm-backdrop";

  const modal = document.createElement("div");
  modal.className = "confirm-modal";

  // Title row
  const titleRow = document.createElement("div");
  titleRow.className = "confirm-title-row";

  const iconWrap = document.createElement("div");
  iconWrap.className = "confirm-icon-wrap";
  iconWrap.textContent = "🗑";

  const titleEl = document.createElement("h2");
  titleEl.className = "confirm-title";
  titleEl.textContent = loggedCount > 0
    ? `Delete ${activityName}?`
    : `Remove ${activityName}?`;

  titleRow.appendChild(iconWrap);
  titleRow.appendChild(titleEl);
  modal.appendChild(titleRow);

  // Body
  const body = document.createElement("div");
  body.className = "confirm-body";

  if (loggedCount > 0) {
    const s = loggedCount === 1 ? "" : "s";
    body.innerHTML = `You've shown up for <strong>${activityName}</strong> ${loggedCount} time${s} this month. Deleting it removes those wins permanently and adjusts your stats. <span class="confirm-body-emphasis">No undoing this one.</span>`;
  } else {
    body.innerHTML = `No days logged yet, so nothing will be lost. <strong>${activityName}</strong> will be removed from your tracker for this month.<span class="confirm-body-note">You can always add it back later.</span>`;
  }

  modal.appendChild(body);

  // Divider
  const divider = document.createElement("div");
  divider.className = "confirm-divider";
  modal.appendChild(divider);

  // Actions
  const actions = document.createElement("div");
  actions.className = "confirm-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "confirm-btn confirm-btn--ghost";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => { backdrop.remove(); modal.remove(); });

  const confirmBtn = document.createElement("button");
  if (loggedCount > 0) {
    confirmBtn.className = "confirm-btn confirm-btn--danger";
    confirmBtn.textContent = "Delete anyway";
  } else {
    confirmBtn.className = "confirm-btn confirm-btn--danger-soft";
    confirmBtn.textContent = "Remove";
  }
  confirmBtn.addEventListener("click", () => {
    backdrop.remove();
    modal.remove();
    onConfirm();
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  modal.appendChild(actions);

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
}
