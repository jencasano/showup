import { db } from "./firebase-config.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast } from "./ui.js";

const ACTIVITY_COLORS = [
  "#D8584E", "#80B9B9", "#F8C08A", "#A29BFE", "#1DD1A1",
];
function getActivityColor(index) {
  return ACTIVITY_COLORS[index % ACTIVITY_COLORS.length];
}

const CADENCE_LABELS = { 1:"1\u00d7", 2:"2\u00d7", 3:"3\u00d7", 4:"4\u00d7", 5:"5\u00d7", 6:"6\u00d7", 7:"Daily" };
function cadLabel(n) { return CADENCE_LABELS[n] || `${n}\u00d7`; }

export function openManageActivitiesModal(entry, yearMonth, currentUser, onMarkToggled) {
  const [year, month] = yearMonth.split("-").map(Number);
  const monthName = new Date(year, month - 1, 1).toLocaleString("default", { month: "long" });

  const initialActivities = [...(entry.activities || [])];
  const initialCadences  = [...(entry.cadences  || initialActivities.map(() => 7))];

  const backdrop = document.createElement("div");
  backdrop.className = "manage-activities-backdrop";

  const modal = document.createElement("div");
  modal.className = "manage-activities-modal";

  const header = document.createElement("div");
  header.className = "ma-header";
  const headerLeft = document.createElement("div");
  const title = document.createElement("div");
  title.className = "ma-title";
  title.textContent = "Manage Activities";
  const subtitle = document.createElement("div");
  subtitle.className = "ma-subtitle";
  subtitle.textContent = `${monthName} ${year} \u00b7 tap a name to rename`;
  headerLeft.appendChild(title);
  headerLeft.appendChild(subtitle);
  const closeBtn = document.createElement("button");
  closeBtn.className = "ma-close";
  closeBtn.textContent = "\u2715";
  closeBtn.addEventListener("click", () => { backdrop.remove(); modal.remove(); });
  header.appendChild(headerLeft);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const list = document.createElement("div");
  list.className = "ma-list";

  const CADENCE_OPTIONS = [
    { label: "1\u00d7", value: 1 }, { label: "2\u00d7", value: 2 },
    { label: "3\u00d7", value: 3 }, { label: "4\u00d7", value: 4 },
    { label: "5\u00d7", value: 5 }, { label: "6\u00d7", value: 6 },
    { label: "Daily",  value: 7 },
  ];

  function buildRow(activityName, cadenceValue, colorIndex) {
    const row = document.createElement("div");
    row.className = "ma-row";
    row.dataset.originalName    = activityName;
    row.dataset.originalCadence = cadenceValue;

    const rowTop = document.createElement("div");
    rowTop.className = "ma-row-top";

    const dot = document.createElement("div");
    dot.className = "ma-dot";
    dot.style.background = getActivityColor(colorIndex);

    // Wrapper holds both the was-hint and the live input stacked vertically
    const nameWrap = document.createElement("div");
    nameWrap.className = "ma-name-wrap";

    // The was-hint: "~~OldName~~ →" shown above the input when name differs
    const nameWasHint = document.createElement("div");
    nameWasHint.className = "ma-name-was-hint";
    nameWasHint.style.display = "none";
    const nameWasSpan = document.createElement("span");
    nameWasSpan.className = "ma-name-was";
    nameWasSpan.textContent = activityName;
    const nameWasArrow = document.createElement("span");
    nameWasArrow.className = "ma-name-arrow";
    nameWasArrow.textContent = "\u2192";
    nameWasHint.appendChild(nameWasSpan);
    nameWasHint.appendChild(nameWasArrow);

    const nameInput = document.createElement("div");
    nameInput.className = "ma-name-edit";
    nameInput.setAttribute("contenteditable", "true");
    nameInput.setAttribute("spellcheck", "false");
    nameInput.textContent = activityName;
    nameInput.addEventListener("focus", () => row.classList.add("is-focused"));
    nameInput.addEventListener("blur",  () => row.classList.remove("is-focused"));
    nameInput.addEventListener("input", () => {
      if (nameInput.textContent.length > 20) {
        nameInput.textContent = nameInput.textContent.slice(0, 20);
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(nameInput);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      const current = nameInput.textContent.trim();
      const original = row.dataset.originalName;
      if (original && current !== original) {
        nameWasHint.style.display = "flex";
      } else {
        nameWasHint.style.display = "none";
      }
    });

    nameWrap.appendChild(nameWasHint);
    nameWrap.appendChild(nameInput);

    row.addEventListener("click", (e) => {
      if (e.target === deleteBtn || e.target.closest(".ma-cadence-btn")) return;
      nameInput.focus();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "ma-delete-btn";
    deleteBtn.title = "Delete activity";
    deleteBtn.textContent = "\ud83d\uddd1\ufe0f";
    deleteBtn.addEventListener("click", () => handleDelete(row));

    const pencil = document.createElement("span");
    pencil.className = "ma-name-pencil";
    pencil.textContent = "\u270f\ufe0f";

    rowTop.appendChild(dot);
    rowTop.appendChild(nameWrap);
    rowTop.appendChild(pencil);
    rowTop.appendChild(deleteBtn);
    row.appendChild(rowTop);

    const cadenceRow = document.createElement("div");
    cadenceRow.className = "ma-cadence-row";
    const cadLabel2 = document.createElement("span");
    cadLabel2.className = "ma-cadence-label";
    cadLabel2.textContent = "Per week";
    cadenceRow.appendChild(cadLabel2);

    const changeIndicator = document.createElement("div");
    changeIndicator.className = "ma-change-indicator";
    changeIndicator.style.display = "none";

    CADENCE_OPTIONS.forEach(opt => {
      const btn = document.createElement("button");
      btn.className = "ma-cadence-btn";
      btn.dataset.value = opt.value;
      btn.textContent = opt.label;
      if (opt.value === cadenceValue) btn.classList.add("active");
      btn.addEventListener("click", () => {
        cadenceRow.querySelectorAll(".ma-cadence-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const originalCad = parseInt(row.dataset.originalCadence, 10);
        if (opt.value !== originalCad) {
          changeIndicator.innerHTML = "";
          const wasSpan = document.createElement("span");
          wasSpan.className = "ma-inline-was";
          wasSpan.textContent = cadLabel(originalCad);
          const arrowSpan = document.createElement("span");
          arrowSpan.className = "ma-inline-arrow";
          arrowSpan.textContent = "\u2192";
          const newSpan = document.createElement("span");
          newSpan.className = "ma-inline-new";
          newSpan.textContent = cadLabel(opt.value);
          changeIndicator.appendChild(wasSpan);
          changeIndicator.appendChild(arrowSpan);
          changeIndicator.appendChild(newSpan);
          changeIndicator.style.display = "flex";
        } else {
          changeIndicator.innerHTML = "";
          changeIndicator.style.display = "none";
        }
      });
      cadenceRow.appendChild(btn);
    });

    cadenceRow.appendChild(changeIndicator);
    row.appendChild(cadenceRow);
    return row;
  }

  initialActivities.forEach((act, i) => {
    list.appendChild(buildRow(act, initialCadences[i] ?? 7, i));
  });
  modal.appendChild(list);

  const addBtn = document.createElement("button");
  addBtn.className = "ma-add-btn";
  addBtn.textContent = "+ Add another activity";
  if (initialActivities.length >= 5) addBtn.style.display = "none";
  addBtn.addEventListener("click", () => {
    const newIndex = list.children.length;
    if (newIndex >= 5) return;
    const row = buildRow("", 7, newIndex);
    list.appendChild(row);
    row.querySelector(".ma-name-edit").focus();
    if (list.children.length >= 5) addBtn.style.display = "none";
  });
  modal.appendChild(addBtn);

  const footer = document.createElement("div");
  footer.className = "ma-footer";
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "ma-btn ma-btn--ghost";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => { backdrop.remove(); modal.remove(); });
  const saveBtn = document.createElement("button");
  saveBtn.className = "ma-btn ma-btn--save";
  saveBtn.textContent = "Save changes";
  saveBtn.addEventListener("click", handleSaveWithConfirm);
  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);
  modal.appendChild(footer);

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) { backdrop.remove(); modal.remove(); }
  });
  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  function handleDelete(row) {
    const activityName = row.querySelector(".ma-name-edit")?.textContent.trim() || "";
    const lookupName   = row.dataset.originalName || activityName;
    const loggedCount  = (entry.marks?.[lookupName] || []).length;
    showDeleteConfirmModal(activityName || "this activity", loggedCount, () => {
      row.remove();
      if (list.children.length < 5) addBtn.style.display = "";
    });
  }

  function collectRows() {
    const rows = [...list.children];
    const newActivities = [], newCadences = [], originalNames = [], originalCadences = [];
    rows.forEach(row => {
      const nameVal = row.querySelector(".ma-name-edit")?.textContent.trim();
      if (!nameVal) return;
      const activeBtn = row.querySelector(".ma-cadence-btn.active");
      const cad = activeBtn ? parseInt(activeBtn.dataset.value, 10) : 7;
      newActivities.push(nameVal);
      newCadences.push(cad);
      originalNames.push(row.dataset.originalName || null);
      originalCadences.push(row.dataset.originalCadence ? parseInt(row.dataset.originalCadence, 10) : null);
    });
    return { newActivities, newCadences, originalNames, originalCadences };
  }

  function handleSaveWithConfirm() {
    const { newActivities, newCadences, originalNames, originalCadences } = collectRows();
    if (newActivities.length === 0) { showToast("You need at least one activity.", "error"); return; }

    const changes = [];
    newActivities.forEach((newName, i) => {
      const origName = originalNames[i];
      const origCad  = originalCadences[i];
      const isNew    = !origName;
      if (isNew) return;
      const renamed    = origName && newName !== origName;
      const recadenced = origCad !== null && newCadences[i] !== origCad;
      if (renamed || recadenced) {
        changes.push({ origName, newName, origCad, newCad: newCadences[i], renamed, recadenced });
      }
    });

    if (changes.length > 0) {
      showEditConfirmModal(changes, () => doSave(newActivities, newCadences, originalNames));
    } else {
      doSave(newActivities, newCadences, originalNames);
    }
  }

  async function doSave(newActivities, newCadences, originalNames) {
    const oldMarks = entry.marks || {};
    const newMarks = {};
    newActivities.forEach((newName, i) => {
      const origName = originalNames[i];
      newMarks[newName] = (origName && oldMarks[origName]) ? oldMarks[origName] : [];
    });

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving\u2026";
    try {
      const logRef = doc(db, "logs", yearMonth, "entries", currentUser.uid);
      await setDoc(logRef, { activities: newActivities, cadences: newCadences, marks: newMarks }, { merge: true });
      entry.activities = newActivities;
      entry.cadences   = newCadences;
      entry.marks      = newMarks;
      if (onMarkToggled) onMarkToggled(entry);
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

// ─── EDIT CONFIRM MODAL ──────────────────────────────────
function showEditConfirmModal(changes, onConfirm) {
  const backdrop = document.createElement("div");
  backdrop.className = "confirm-backdrop";
  const modal = document.createElement("div");
  modal.className = "confirm-modal";

  const anyRename    = changes.some(c => c.renamed);
  const anyRecadence = changes.some(c => c.recadenced);
  const isSingle     = changes.length === 1;
  const c0           = changes[0];

  const titleRow = document.createElement("div");
  titleRow.className = "confirm-title-row";
  const iconWrap = document.createElement("div");
  iconWrap.className = "confirm-icon-wrap";

  const titleEl = document.createElement("h2");
  titleEl.className = "confirm-title";
  if (isSingle) {
    if (c0.renamed && c0.recadenced) {
      iconWrap.textContent = "\u270f\ufe0f";
      titleEl.innerHTML = `Renaming <span class="confirm-highlight">\u201c${c0.origName}\u201d</span> to <span class="confirm-new">\u201c${c0.newName}\u201d</span> and updating your target from <span class="confirm-highlight">${cadLabel(c0.origCad)}</span> to <span class="confirm-new">${cadLabel(c0.newCad)}</span>?`;
    } else if (c0.renamed) {
      iconWrap.textContent = "\u270f\ufe0f";
      titleEl.innerHTML = `Renaming <span class="confirm-highlight">\u201c${c0.origName}\u201d</span> to <span class="confirm-new">\u201c${c0.newName}\u201d</span>?`;
    } else {
      iconWrap.textContent = "\ud83d\udcc5";
      titleEl.innerHTML = `Updating your target for \u201c${c0.origName}\u201d from <span class="confirm-highlight">${cadLabel(c0.origCad)}</span> to <span class="confirm-new">${cadLabel(c0.newCad)}</span>?`;
    }
  } else {
    iconWrap.textContent = anyRename ? "\u270f\ufe0f" : "\ud83d\udcc5";
    titleEl.textContent = `Saving ${changes.length} changes?`;
  }
  titleRow.appendChild(iconWrap);
  titleRow.appendChild(titleEl);
  modal.appendChild(titleRow);

  const body = document.createElement("div");
  body.className = "confirm-body";

  if (isSingle) {
    if (c0.renamed && c0.recadenced) {
      body.innerHTML = `Your logged days carry over under the new name, and stats will recalculate going forward based on the new target. <span class="confirm-new">You're good.</span>`;
    } else if (c0.renamed) {
      body.innerHTML = `Your logged days and stats carry over automatically under the new name. <span class="confirm-new">Nothing gets lost.</span>`;
    } else {
      body.innerHTML = `Your stats will recalculate from here based on the new target. <span class="confirm-new">Everything you've already logged stays.</span>`;
    }
  } else {
    const intro = document.createElement("span");
    intro.textContent = "Here's what you're updating:";
    body.appendChild(intro);

    const ul = document.createElement("ul");
    ul.className = "confirm-change-list";
    changes.forEach(c => {
      const li = document.createElement("li");
      if (c.renamed && c.recadenced) {
        li.innerHTML = `\u270f\ufe0f\ud83d\udcc5 <span class="confirm-highlight">${c.origName}</span> \u2192 <span class="confirm-new">${c.newName}</span>, <span class="confirm-highlight">${cadLabel(c.origCad)}</span> \u2192 <span class="confirm-new">${cadLabel(c.newCad)}</span>`;
      } else if (c.renamed) {
        li.innerHTML = `\u270f\ufe0f <span class="confirm-highlight">${c.origName}</span> \u2192 <span class="confirm-new">${c.newName}</span>`;
      } else {
        li.innerHTML = `\ud83d\udcc5 <span class="confirm-highlight">${c.origName}</span>: <span class="confirm-highlight">${cadLabel(c.origCad)}</span> \u2192 <span class="confirm-new">${cadLabel(c.newCad)}</span>`;
      }
      ul.appendChild(li);
    });
    body.appendChild(ul);

    const note = document.createElement("div");
    note.className = "confirm-body-note";
    note.style.display = "block";
    note.style.marginTop = "8px";
    if (anyRename && anyRecadence) {
      note.textContent = "Renames carry your logs over automatically. Cadence changes will recalculate stats from here.";
    } else if (anyRename) {
      note.textContent = "Renames carry your logs over automatically. Nothing gets lost.";
    } else {
      note.textContent = "Stats will recalculate going forward based on the new targets. Your logged days stay.";
    }
    body.appendChild(note);
  }

  modal.appendChild(body);

  const divider = document.createElement("div");
  divider.className = "confirm-divider";
  modal.appendChild(divider);

  const actions = document.createElement("div");
  actions.className = "confirm-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "confirm-btn confirm-btn--ghost";
  cancelBtn.textContent = "Go back";
  cancelBtn.addEventListener("click", () => { backdrop.remove(); modal.remove(); });

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "confirm-btn confirm-btn--save";
  if (isSingle && c0.renamed && !c0.recadenced) {
    confirmBtn.textContent = "Yes, rename";
  } else if (isSingle && c0.recadenced && !c0.renamed) {
    confirmBtn.textContent = "Got it, update";
  } else {
    confirmBtn.textContent = "Save it";
  }
  confirmBtn.addEventListener("click", () => { backdrop.remove(); modal.remove(); onConfirm(); });

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  modal.appendChild(actions);

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
}

// ─── DELETE CONFIRM MODAL ─────────────────────────────────
export function showDeleteConfirmModal(activityName, loggedCount, onConfirm) {
  const backdrop = document.createElement("div");
  backdrop.className = "confirm-backdrop";
  const modal = document.createElement("div");
  modal.className = "confirm-modal";

  const titleRow = document.createElement("div");
  titleRow.className = "confirm-title-row";
  const iconWrap = document.createElement("div");
  iconWrap.className = "confirm-icon-wrap";
  iconWrap.textContent = "\ud83d\uddd1";
  const titleEl = document.createElement("h2");
  titleEl.className = "confirm-title";
  titleEl.textContent = loggedCount > 0 ? `Delete ${activityName}?` : `Remove ${activityName}?`;
  titleRow.appendChild(iconWrap);
  titleRow.appendChild(titleEl);
  modal.appendChild(titleRow);

  const body = document.createElement("div");
  body.className = "confirm-body";
  if (loggedCount > 0) {
    const s = loggedCount === 1 ? "" : "s";
    body.innerHTML = `You've shown up for <span class="confirm-highlight">${activityName}</span> <span class="confirm-highlight">${loggedCount} time${s}</span> this month. Deleting it removes those wins permanently and adjusts your stats. <span class="confirm-body-emphasis">No undoing this one.</span>`;
  } else {
    body.innerHTML = `No days logged yet, so nothing will be lost. <span class="confirm-highlight">${activityName}</span> will be removed from your tracker for this month.<span class="confirm-body-note">You can always add it back later.</span>`;
  }
  modal.appendChild(body);

  const divider = document.createElement("div");
  divider.className = "confirm-divider";
  modal.appendChild(divider);

  const actions = document.createElement("div");
  actions.className = "confirm-actions";
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "confirm-btn confirm-btn--ghost";
  cancelBtn.textContent = "Keep it";
  cancelBtn.addEventListener("click", () => { backdrop.remove(); modal.remove(); });
  const confirmBtn = document.createElement("button");
  confirmBtn.className = loggedCount > 0 ? "confirm-btn confirm-btn--danger" : "confirm-btn confirm-btn--danger-soft";
  confirmBtn.textContent = loggedCount > 0 ? "Delete anyway" : "Remove";
  confirmBtn.addEventListener("click", () => { backdrop.remove(); modal.remove(); onConfirm(); });
  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  modal.appendChild(actions);

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
}
