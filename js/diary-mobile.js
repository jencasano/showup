import { getDiaryDays, getDiaryEntry, saveDiaryEntry, saveDiaryTheme, uploadDiaryPhoto, deleteDiaryPhoto } from "./diary.js";
import { DIARY_THEMES, DEFAULT_DIARY_THEME } from "./diary-themes.js";
import { getDaysInMonth, getCurrentYearMonth, getActivityColor } from "./utils.js";
import { showToast } from "./ui.js";

// ─── HELPERS ────────────────────────────────────────
function hexWithOpacity(hex, opacity) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

// ─── CROP UI ─────────────────────────────────────────
function showCropUI(file, onConfirm) {
  const overlay = document.createElement("div");
  overlay.className = "diary-crop-overlay";

  // Hint
  const hint = document.createElement("div");
  hint.textContent = "Drag to reposition \u00b7 Pinch or scroll to zoom";
  hint.style.cssText = "font-size:0.72rem;color:rgba(255,255,255,0.5);text-align:center;";
  overlay.appendChild(hint);

  // Crop frame
  const frame = document.createElement("div");
  frame.className = "diary-crop-frame";

  const bgImg = document.createElement("img");
  bgImg.className = "diary-crop-bg-img";
  bgImg.style.display = "none";
  frame.appendChild(bgImg);

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
  cancelBtn.addEventListener("click", () => { URL.revokeObjectURL(objectUrl); overlay.remove(); });

  const fitBtn = document.createElement("button");
  fitBtn.className = "diary-crop-fit-btn";
  fitBtn.textContent = "Fit";

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "diary-crop-confirm";
  confirmBtn.textContent = "Use Photo";

  toolbar.appendChild(cancelBtn);
  toolbar.appendChild(fitBtn);
  toolbar.appendChild(confirmBtn);
  overlay.appendChild(toolbar);
  document.body.appendChild(overlay);

  // State
  let imgNaturalW = 0, imgNaturalH = 0;
  let frameSize = 0;
  let scale = 1, minScale = 1, fitScale = 1;
  let dx = 0, dy = 0; // offset of img center from frame center
  let fitMode = false;

  function clampOffset() {
    const maxDx = Math.max(0, (imgNaturalW * scale - frameSize) / 2);
    const maxDy = Math.max(0, (imgNaturalH * scale - frameSize) / 2);
    dx = Math.max(-maxDx, Math.min(maxDx, dx));
    dy = Math.max(-maxDy, Math.min(maxDy, dy));
  }

  function applyTransform() {
    cropImg.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale})`;
  }

  function enterFitMode() {
    fitMode = true;
    fitBtn.classList.add("active");
    hint.textContent = "Entire photo will be used";
    frame.style.cursor = "default";
    grid.style.display = "none";
    bgImg.style.display = "block";
    scale = fitScale;
    dx = 0; dy = 0;
    applyTransform();
  }

  function enterFillMode() {
    fitMode = false;
    fitBtn.classList.remove("active");
    hint.textContent = "Drag to reposition \u00b7 Pinch or scroll to zoom";
    frame.style.cursor = "";
    grid.style.display = "";
    bgImg.style.display = "none";
    scale = minScale;
    dx = 0; dy = 0;
    applyTransform();
  }

  fitBtn.addEventListener("click", () => fitMode ? enterFillMode() : enterFitMode());

  cropImg.onload = () => {
    imgNaturalW = cropImg.naturalWidth;
    imgNaturalH = cropImg.naturalHeight;
    frameSize = frame.getBoundingClientRect().width;
    minScale = frameSize / Math.min(imgNaturalW, imgNaturalH);
    fitScale = frameSize / Math.max(imgNaturalW, imgNaturalH);
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
  bgImg.src = objectUrl;

  // ── Drag (mouse + touch) ──────────────────────────
  let dragging = false, lastX = 0, lastY = 0;

  frame.addEventListener("mousedown", (e) => {
    if (fitMode) return;
    dragging = true;
    lastX = e.clientX; lastY = e.clientY;
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging || fitMode) return;
    dx += e.clientX - lastX;
    dy += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    clampOffset(); applyTransform();
  });
  window.addEventListener("mouseup", () => { dragging = false; });

  // ── Touch drag + pinch ────────────────────────────
  let lastTouches = null, pinchStartDist = 0, pinchStartScale = 1;

  frame.addEventListener("touchstart", (e) => {
    if (fitMode) return;
    e.preventDefault();
    lastTouches = e.touches;
    if (e.touches.length === 2) {
      const a = e.touches[0], b = e.touches[1];
      pinchStartDist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      pinchStartScale = scale;
    }
  }, { passive: false });

  frame.addEventListener("touchmove", (e) => {
    if (fitMode) return;
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
    if (fitMode) return;
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

    if (fitMode) {
      // Blurred background via downscale→upscale (no ctx.filter — works on Safari iOS)
      const SMALL = 80;
      const offscreen = document.createElement("canvas");
      offscreen.width = SMALL; offscreen.height = SMALL;
      const octx = offscreen.getContext("2d");
      const bgScale = SMALL / Math.min(imgNaturalW, imgNaturalH);
      const bgW = imgNaturalW * bgScale;
      const bgH = imgNaturalH * bgScale;
      octx.drawImage(cropImg, (SMALL - bgW) / 2, (SMALL - bgH) / 2, bgW, bgH);
      ctx.drawImage(offscreen, 0, 0, OUT, OUT);
      // Frosted overlay
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(0, 0, OUT, OUT);
      // Foreground: image scaled to fit within OUT×OUT, centered
      const fgScale = OUT / Math.max(imgNaturalW, imgNaturalH);
      const fgW = imgNaturalW * fgScale;
      const fgH = imgNaturalH * fgScale;
      ctx.drawImage(cropImg, (OUT - fgW) / 2, (OUT - fgH) / 2, fgW, fgH);
    } else {
      // Fill mode: crop visible region
      const imgCenterX = frameSize / 2 + dx;
      const imgCenterY = frameSize / 2 + dy;
      const srcLeft = (imgNaturalW / 2) - (imgCenterX / scale);
      const srcTop  = (imgNaturalH / 2) - (imgCenterY / scale);
      const srcSize = frameSize / scale;
      ctx.drawImage(cropImg, srcLeft, srcTop, srcSize, srcSize, 0, 0, OUT, OUT);
    }

    canvas.toBlob((blob) => {
      console.log("Diary photo compressed:", Math.round(blob.size / 1024) + "KB");
      URL.revokeObjectURL(objectUrl);
      overlay.remove();
      const croppedFile = new File([blob], "diary-photo.jpg", { type: "image/jpeg" });
      onConfirm(croppedFile);
    }, "image/jpeg", 0.82);
  });
}

// ─── OPEN DIARY PAGE ────────────────────────────────
export function openDiaryPage(day, entry, yearMonth, userId, existingDiaryEntry, onSaved = null, onBack = null) {
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

  // ── Backdrop ─────────────────────────────────────
  const backdrop = document.createElement("div");
  backdrop.className = "diary-page-backdrop";

  // ── Overlay ──────────────────────────────────────
  const overlay = document.createElement("div");
  overlay.className = "diary-page-overlay";

  function closeAll(onDone) {
    document.removeEventListener("keydown", onKeyDown);
    overlay.style.transition = "opacity 0.35s ease";
    backdrop.style.transition = "opacity 0.35s ease";
    overlay.style.opacity = "0";
    backdrop.style.opacity = "0";
    setTimeout(() => {
      backdrop.remove();
      overlay.remove();
      onDone?.();
    }, 350);
  }

  function tryClose() {
    const originalNote = existingDiaryEntry?.note || "";
    const isDirty = textarea.value !== originalNote || newPhotoFile !== null || photoToDelete;
    if (isDirty && !confirm("You have unsaved changes. Leave without saving?")) return;
    closeAll(() => onBack?.());
  }

  function onKeyDown(e) {
    if (e.key === "Escape") tryClose();
  }
  document.addEventListener("keydown", onKeyDown);
  backdrop.addEventListener("click", () => tryClose());

  // ── Top Nav ──────────────────────────────────────
  const nav = document.createElement("div");
  nav.className = "diary-page-nav";

  const backBtn = document.createElement("button");
  backBtn.className = "diary-page-nav-back";
  backBtn.textContent = "\u2190 back";
  backBtn.addEventListener("click", () => tryClose());

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

  // ── Two-column content area ──────────────────────
  const content = document.createElement("div");
  content.className = "diary-page-content";

  // ── LEFT COLUMN ───────────────────────────────────
  const leftCol = document.createElement("div");
  leftCol.className = "diary-page-left";

  // Date hero section (grouped for height measurement)
  const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" });
  const monthName = date.toLocaleDateString("en-US", { month: "long" });

  const leftHero = document.createElement("div");
  leftHero.className = "diary-page-left-hero";

  const dateBig = document.createElement("div");
  dateBig.className = "diary-page-date-big";
  dateBig.innerHTML = `${dayOfWeek}, <strong>${day}</strong>`;
  leftHero.appendChild(dateBig);

  const dateSub = document.createElement("div");
  dateSub.className = "diary-page-date-sub";
  dateSub.textContent = isToday ? "Today \u2728" : monthName;
  leftHero.appendChild(dateSub);

  const chips = document.createElement("div");
  chips.className = "diary-habit-chips";
  activities.forEach((act, i) => {
    const marked = (marks[act] || []).includes(day);
    const chip = document.createElement("span");
    if (marked) {
      chip.className = "diary-habit-chip";
      chip.style.background = getActivityColor(i);
      chip.textContent = `\u2713 ${act}`;
    } else {
      chip.className = "diary-habit-chip diary-habit-chip--undone";
      chip.textContent = act;
    }
    chips.appendChild(chip);
  });
  leftHero.appendChild(chips);

  const rule = document.createElement("hr");
  rule.className = "diary-page-rule";
  leftHero.appendChild(rule);

  leftCol.appendChild(leftHero);

  const noteLabel = document.createElement("div");
  noteLabel.className = "diary-section-label";
  noteLabel.textContent = "today's note";
  leftCol.appendChild(noteLabel);

  const textarea = document.createElement("textarea");
  textarea.className = "diary-note-textarea";
  textarea.maxLength = 280;
  textarea.placeholder = "what was today like? how did it feel to show up...";
  textarea.value = existingDiaryEntry?.note || "";
  textarea.addEventListener("focus", () => { textarea.style.borderColor = "var(--color-primary)"; });
  textarea.addEventListener("blur",  () => { textarea.style.borderColor = "#D5C9A8"; });
  leftCol.appendChild(textarea);

  const charCounter = document.createElement("div");
  charCounter.className = "diary-note-char";
  charCounter.textContent = `${textarea.value.length} / 280`;
  textarea.addEventListener("input", () => {
    charCounter.textContent = `${textarea.value.length} / 280`;
    updateDirty();
  });
  leftCol.appendChild(charCounter);

  content.appendChild(leftCol);

  // ── RIGHT COLUMN ──────────────────────────────────
  const rightCol = document.createElement("div");
  rightCol.className = "diary-page-right";

  // Spacer to align photo label with note label
  const rightSpacer = document.createElement("div");
  rightSpacer.className = "diary-page-right-spacer";
  rightCol.appendChild(rightSpacer);

  const photoLabel = document.createElement("div");
  photoLabel.className = "diary-section-label";
  photoLabel.textContent = "photo";
  rightCol.appendChild(photoLabel);

  const polaroidWrap = document.createElement("div");
  polaroidWrap.className = "diary-page-polaroid-wrap";

  const polaroid = document.createElement("div");
  polaroid.className = "diary-page-polaroid";

  const polaroidInner = document.createElement("div");
  polaroidInner.className = "diary-page-polaroid-inner";
  polaroid.appendChild(polaroidInner);

  polaroidWrap.appendChild(polaroid);
  rightCol.appendChild(polaroidWrap);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  rightCol.appendChild(fileInput);

  content.appendChild(rightCol);

  // Save button — after right col so mobile order is: note → photo → save
  const saveBtn = document.createElement("button");
  saveBtn.className = "diary-page-save-btn";
  saveBtn.textContent = "Save";
  saveBtn.disabled = true;
  content.appendChild(saveBtn);

  overlay.appendChild(content);
  document.body.appendChild(backdrop);
  document.body.appendChild(overlay);

  // Set spacer height to match left hero block after layout
  setTimeout(() => {
    rightSpacer.style.height = leftHero.offsetHeight + "px";
  }, 0);

  // ── Photo state helpers ───────────────────────────
  function showPhotoEmpty() {
    polaroidInner.innerHTML = `
      <span style="font-size:1.5rem;opacity:0.3">\ud83d\udcf7</span>
      <span style="font-size:0.55rem;color:#B5A88A;font-family:'Sora',sans-serif">add photo</span>
    `;
    polaroid.classList.remove("has-photo");
    polaroid.style.cursor = "pointer";
    polaroid.onclick = () => fileInput.click();
  }

  function showPhotoFilled(src) {
    polaroidInner.innerHTML = "";
    const img = document.createElement("img");
    img.src = src;
    polaroidInner.appendChild(img);

    const removeBtn = document.createElement("button");
    removeBtn.className = "diary-page-polaroid-remove";
    removeBtn.textContent = "\u00d7";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      photoToDelete = true;
      newPhotoFile = null;
      currentPhotoUrl = null;
      showPhotoEmpty();
      updateDirty();
    });
    polaroidInner.appendChild(removeBtn);

    polaroid.classList.add("has-photo");
    polaroid.style.cursor = "default";
    polaroid.onclick = null;
  }

  if (currentPhotoUrl) {
    showPhotoFilled(currentPhotoUrl);
  } else {
    showPhotoEmpty();
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
      showPhotoFilled(URL.createObjectURL(croppedFile));
      updateDirty();
    });
  });

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
      closeAll(() => { if (onSaved) onSaved(); });
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

// ─── MOBILE DIARY CARD (closed notebook) ─────────────────────
export async function renderMobileDiaryCard(userId, yearMonth, theme = DEFAULT_DIARY_THEME) {
  const t = DIARY_THEMES[theme] || DIARY_THEMES[DEFAULT_DIARY_THEME];
  const [year, month] = yearMonth.split("-").map(Number);
  const monthName = new Date(year, month - 1, 1).toLocaleString("default", { month: "long" });
  const swatchColors = { coral: "#C3342B", cream: "#ede2d0", indigo: "#2A2E45" };

  const card = document.createElement("div");
  card.className = "mob-diary-card";
  card.style.borderColor = t.bookBorder;

  // ── Spine ──────────────────────────────────────────────────
  const spine = document.createElement("div");
  spine.className = "mob-diary-spine";
  spine.style.background = t.spineBg;
  for (let i = 0; i < 10; i++) {
    const outer = document.createElement("span");
    outer.className = "mob-diary-hole-outer";
    outer.style.background = t.holeBg;
    spine.appendChild(outer);
  }
  card.appendChild(spine);

  // ── Cover ─────────────────────────────────────────────────
  const cover = document.createElement("div");
  cover.className = "mob-diary-cover";
  cover.style.background = t.coverGradient;

  // Pages edge
  const pagesEdge = document.createElement("div");
  pagesEdge.className = "mob-diary-pages-edge";
  cover.appendChild(pagesEdge);

  // Ribbon
  const ribbon = document.createElement("div");
  ribbon.className = "mob-diary-ribbon";
  ribbon.style.background = t.ribbonBg;
  cover.appendChild(ribbon);

  // Gutter
  const gutter = document.createElement("div");
  gutter.className = "mob-diary-gutter";
  gutter.style.background = t.gutterBg;
  cover.appendChild(gutter);

  // Corner triangles
  const cornerBL = document.createElement("div");
  cornerBL.className = "mob-diary-corner--bl";
  cornerBL.style.background = t.cornerColor;
  const cornerBR = document.createElement("div");
  cornerBR.className = "mob-diary-corner--br";
  cornerBR.style.background = t.cornerColor;
  cover.appendChild(cornerBL);
  cover.appendChild(cornerBR);

  // Content
  const content = document.createElement("div");
  content.className = "mob-diary-content";

  // Top block
  const top = document.createElement("div");
  const titleEl = document.createElement("div");
  titleEl.className = "mob-diary-title";
  titleEl.textContent = "diary.";
  titleEl.style.color = t.titleColor;
  const monthEl = document.createElement("div");
  monthEl.className = "mob-diary-month";
  monthEl.textContent = `${monthName} ${year}`;
  monthEl.style.color = t.monthColor;
  const taglineEl = document.createElement("div");
  taglineEl.className = "mob-diary-tagline";
  taglineEl.textContent = "i show up. period.";
  taglineEl.style.color = t.taglineColor;
  top.appendChild(titleEl);
  top.appendChild(monthEl);
  top.appendChild(taglineEl);
  content.appendChild(top);

  const rule = document.createElement("div");
  rule.className = "mob-diary-rule";
  rule.style.background = t.ruleColor;
  content.appendChild(rule);

  // Bottom block
  const bottom = document.createElement("div");
  bottom.className = "mob-diary-bottom";

  const stat = document.createElement("div");
  stat.className = "mob-diary-stat";
  const statNum = document.createElement("strong");
  statNum.style.color = t.statColor;
  statNum.textContent = "\u2026";
  const statLabel = document.createElement("span");
  statLabel.style.color = t.statLabelColor;
  statLabel.textContent = "entries";
  stat.appendChild(statNum);
  stat.appendChild(statLabel);

  const rightGroup = document.createElement("div");
  rightGroup.className = "mob-diary-bottom-right";

  // Palette swatches
  const swatchRow = document.createElement("div");
  swatchRow.className = "mob-diary-swatch-row";
  for (const key of Object.keys(DIARY_THEMES)) {
    const sw = document.createElement("button");
    sw.className = "mob-diary-swatch" + (key === theme ? " active" : "");
    sw.style.setProperty("--swatch-bg", swatchColors[key]);
    sw.addEventListener("click", async (e) => {
      e.stopPropagation();
      await saveDiaryTheme(userId, key);
      const col = card.closest(".mob-diary-col") || card.parentElement;
      const newCard = await renderMobileDiaryCard(userId, yearMonth, key);
      col.style.transition = "opacity 0.3s ease";
      col.style.opacity = "0";
      setTimeout(() => {
        card.replaceWith(newCard);
        col.style.opacity = "1";
      }, 300);
    });
    swatchRow.appendChild(sw);
  }

  const hint = document.createElement("span");
  hint.className = "mob-diary-hint";
  hint.textContent = "read it \u2192";
  hint.style.color = t.hintColor;

  rightGroup.appendChild(swatchRow);
  rightGroup.appendChild(hint);
  bottom.appendChild(stat);
  bottom.appendChild(rightGroup);
  content.appendChild(bottom);

  cover.appendChild(content);
  card.appendChild(cover);

  // Load diary days async and update count
  getDiaryDays(userId, yearMonth).then(diaryDays => {
    statNum.textContent = diaryDays.size;
    card.addEventListener("click", () => openMobileDiarySheet(userId, yearMonth, diaryDays, theme));
  });

  return card;
}

// ─── MOBILE DIARY SHEET (open notebook) ──────────────────────
export function openMobileDiarySheet(userId, yearMonth, diaryDays, theme = DEFAULT_DIARY_THEME, initialDay = null, fadeIn = false) {
  const t = DIARY_THEMES[theme] || DIARY_THEMES[DEFAULT_DIARY_THEME];
  const swatchColors = { coral: "#C3342B", cream: "#ede2d0", indigo: "#2A2E45" };
  const [year, month] = yearMonth.split("-").map(Number);
  const daysInMonth = getDaysInMonth(yearMonth);
  const isCurrentMonth = yearMonth === getCurrentYearMonth();
  const todayDate = new Date().getDate();
  const monthName = new Date(year, month - 1, 1).toLocaleString("default", { month: "long" });
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  // ── Overlay ───────────────────────────────────────────────
  const overlay = document.createElement("div");
  overlay.className = "mob-diary-overlay";

  const sheet = document.createElement("div");
  sheet.className = "mob-diary-sheet";
  if (fadeIn) {
    overlay.style.opacity = "0";
  } else {
    sheet.style.transform = "translateY(100%)";
  }

  // ── Top spine ─────────────────────────────────────────────
  const sheetSpine = document.createElement("div");
  sheetSpine.className = "mob-diary-sheet-spine";
  sheetSpine.style.background = t.spineBg;
  for (let i = 0; i < 10; i++) {
    const h = document.createElement("span");
    h.className = "mob-diary-hole-outer";
    h.style.background = t.holeBg;
    sheetSpine.appendChild(h);
  }
  sheet.appendChild(sheetSpine);

  // ── Top bar ───────────────────────────────────────────────
  const topbar = document.createElement("div");
  topbar.className = "mob-diary-sheet-topbar";
  topbar.style.background = t.coverGradient;

  const topbarLeft = document.createElement("div");
  const topbarTitle = document.createElement("div");
  topbarTitle.className = "mob-diary-sheet-topbar-title";
  topbarTitle.textContent = "diary.";
  topbarTitle.style.color = t.titleColor;
  const topbarSub = document.createElement("div");
  topbarSub.className = "mob-diary-sheet-topbar-sub";
  topbarSub.textContent = `${monthName} ${year} \u00b7 ${diaryDays.size} entries`;
  topbarSub.style.color = t.monthColor;
  topbarLeft.appendChild(topbarTitle);
  topbarLeft.appendChild(topbarSub);

  const closeBtn = document.createElement("button");
  closeBtn.className = "mob-diary-sheet-close";
  closeBtn.textContent = "\u2715";
  closeBtn.addEventListener("click", dismiss);

  topbar.appendChild(topbarLeft);
  topbar.appendChild(closeBtn);
  sheet.appendChild(topbar);

  // ── Palette bar ───────────────────────────────────────────
  const paletteBar = document.createElement("div");
  paletteBar.className = "mob-diary-sheet-palette";
  paletteBar.style.background = t.coverGradient;
  for (const key of Object.keys(DIARY_THEMES)) {
    const sw = document.createElement("button");
    sw.className = "mob-diary-swatch" + (key === theme ? " active" : "");
    sw.style.setProperty("--swatch-bg", swatchColors[key]);
    sw.addEventListener("click", async () => {
      await saveDiaryTheme(userId, key);
      dismiss();
      // Re-render closed card
      const col = document.querySelector(".mob-diary-col") || document.querySelector(".mob-diary-card")?.parentElement;
      if (col) {
        const newCard = await renderMobileDiaryCard(userId, yearMonth, key);
        col.style.transition = "opacity 0.3s ease";
        col.style.opacity = "0";
        setTimeout(() => {
          const oldCard = col.querySelector(".mob-diary-card");
          if (oldCard) oldCard.replaceWith(newCard);
          col.style.opacity = "1";
        }, 300);
      }
      openMobileDiarySheet(userId, yearMonth, diaryDays, key, activeDay);
    });
    paletteBar.appendChild(sw);
  }
  sheet.appendChild(paletteBar);

  // ── Notebook body ─────────────────────────────────────────
  const nbBody = document.createElement("div");
  nbBody.className = "mob-diary-nb-body";

  // Strip row (pips + cal button)
  const stripRow = document.createElement("div");
  stripRow.className = "mob-diary-strip-row";

  const strip = document.createElement("div");
  strip.className = "mob-diary-strip";

  const pipEls = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const pip = document.createElement("div");
    pip.className = "mob-diary-pip";
    const isFuture = isCurrentMonth && d > todayDate;
    if (isFuture) pip.classList.add("future");
    if (diaryDays.has(d)) pip.classList.add("has-entry");
    const dow = new Date(year, month - 1, d).toLocaleDateString("en-US", { weekday: "narrow" });
    pip.innerHTML = `<span class="mob-diary-pip-num">${d}</span><span class="mob-diary-pip-dow">${dow}</span>`;
    if (!isFuture) pip.addEventListener("click", () => selectDay(d));
    pipEls[d] = pip;
    strip.appendChild(pip);
  }

  const calBtn = document.createElement("button");
  calBtn.className = "mob-diary-cal-btn";
  calBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="2" width="11" height="10" rx="1.5" stroke="currentColor" stroke-width="1.2"/><line x1="1" y1="5" x2="12" y2="5" stroke="currentColor" stroke-width="1.2"/><line x1="4" y1="1" x2="4" y2="3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="9" y1="1" x2="9" y2="3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;
  calBtn.addEventListener("click", () => openCalSheet());

  stripRow.appendChild(strip);
  stripRow.appendChild(calBtn);
  nbBody.appendChild(stripRow);

  // Entry area (flip card) — no perspective/transform-style needed for scaleX flip
  const entryArea = document.createElement("div");
  entryArea.className = "mob-diary-entry-area";

  const flipCard = document.createElement("div");
  flipCard.className = "mob-diary-flip-card";

  const flipFace = document.createElement("div");
  flipFace.className = "mob-diary-flip-face";
  flipCard.appendChild(flipFace);
  entryArea.appendChild(flipCard);

  // Calendar overlay
  const calOverlay = document.createElement("div");
  calOverlay.className = "mob-diary-cal-overlay";

  const calSheet = document.createElement("div");
  calSheet.className = "mob-diary-cal-sheet";

  const calHandle = document.createElement("div");
  calHandle.className = "mob-diary-cal-handle";
  calSheet.appendChild(calHandle);

  const calHeadRow = document.createElement("div");
  calHeadRow.className = "mob-diary-cal-head-row";
  const calTitle = document.createElement("div");
  calTitle.className = "mob-diary-cal-title";
  calTitle.textContent = `${monthName} ${year}`;
  const calClose = document.createElement("button");
  calClose.className = "mob-diary-cal-close";
  calClose.textContent = "\u2715";
  calClose.addEventListener("click", closeCalSheet);
  calHeadRow.appendChild(calTitle);
  calHeadRow.appendChild(calClose);
  calSheet.appendChild(calHeadRow);

  const calGridWrap = document.createElement("div");
  calGridWrap.className = "mob-diary-cal-grid-wrap";

  const dowRow = document.createElement("div");
  dowRow.className = "mob-diary-cal-dow-row";
  ["S","M","T","W","T","F","S"].forEach(d => {
    const cell = document.createElement("div");
    cell.className = "mob-diary-cal-dow";
    cell.textContent = d;
    dowRow.appendChild(cell);
  });
  calGridWrap.appendChild(dowRow);

  const calGrid = document.createElement("div");
  calGrid.className = "mob-diary-cal-grid";
  const calCells = {};

  for (let i = 0; i < firstDayOfWeek; i++) {
    const off = document.createElement("div");
    off.className = "mob-diary-cal-cell offset";
    calGrid.appendChild(off);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    cell.className = "mob-diary-cal-cell";
    const isFuture = isCurrentMonth && d > todayDate;
    if (isFuture) cell.classList.add("future");
    if (isCurrentMonth && d === todayDate) cell.classList.add("today");
    if (diaryDays.has(d)) {
      const dot = document.createElement("div");
      dot.className = "mob-diary-cal-dot";
      const num = document.createElement("div");
      num.className = "mob-diary-cal-num";
      num.textContent = d;
      cell.appendChild(num);
      cell.appendChild(dot);
    } else {
      const num = document.createElement("div");
      num.className = "mob-diary-cal-num";
      num.textContent = d;
      cell.appendChild(num);
    }
    if (!isFuture) cell.addEventListener("click", () => { closeCalSheet(); selectDay(d); });
    calCells[d] = cell;
    calGrid.appendChild(cell);
  }

  calGridWrap.appendChild(calGrid);
  calSheet.appendChild(calGridWrap);
  calOverlay.appendChild(calSheet);
  entryArea.appendChild(calOverlay);

  nbBody.appendChild(entryArea);
  sheet.appendChild(nbBody);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  // ── State ─────────────────────────────────────────────────
  let activeDay = null;
  let isFlipping = false;

  // Animation duration must match CSS (0.42s). Swap content at 45% = ~189ms.
  const FLIP_DURATION = 420;
  const FLIP_SWAP_AT  = Math.round(FLIP_DURATION * 0.45);

  function openCalSheet() {
    calOverlay.classList.add("open");
  }
  function closeCalSheet() {
    calOverlay.classList.remove("open");
  }

  function updateActivePip(d) {
    Object.values(pipEls).forEach(p => p.classList.remove("active"));
    if (pipEls[d]) {
      pipEls[d].classList.add("active");
      pipEls[d].scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
    }
    Object.values(calCells).forEach(c => c.classList.remove("active"));
    if (calCells[d]) calCells[d].classList.add("active");
  }

  async function renderFaceContent(d) {
    flipFace.innerHTML = "";
    const isFuture = isCurrentMonth && d > todayDate;
    if (isFuture) return;

    const date = new Date(year, month - 1, d);
    const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" });
    const isToday = isCurrentMonth && d === todayDate;

    const dateEl = document.createElement("div");
    dateEl.className = "diary-modal-entry-date";
    dateEl.innerHTML = `${dayOfWeek}, <strong style="color:var(--color-primary)">${d}</strong>`;
    flipFace.appendChild(dateEl);

    if (isToday) {
      const sub = document.createElement("div");
      sub.style.cssText = "font-size:0.6rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(139,100,60,0.6);margin-bottom:6px;";
      sub.textContent = `${monthName.toUpperCase()} ${year} \u00b7 today \u2728`;
      flipFace.appendChild(sub);
    }

    // Loading placeholder
    const loadEl = document.createElement("div");
    loadEl.style.cssText = "color:#B5A88A;font-family:'Caveat',cursive;font-size:1rem;padding-top:8px";
    loadEl.textContent = "loading\u2026";
    flipFace.appendChild(loadEl);

    const diaryEntry = await getDiaryEntry(userId, yearMonth, d);
    loadEl.remove();

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
      flipFace.appendChild(chipsRow);
    }

    const divider = document.createElement("div");
    divider.style.cssText = "height:1px;background:rgba(139,100,60,0.15);margin:8px 0;";
    flipFace.appendChild(divider);

    if (diaryEntry?.note) {
      const noteEl = document.createElement("div");
      noteEl.className = "diary-modal-entry-note";
      noteEl.textContent = diaryEntry.note;
      flipFace.appendChild(noteEl);
    }

    if (diaryEntry?.photoUrl) {
      const polaroid = document.createElement("div");
      polaroid.className = "diary-modal-polaroid";
      const img = document.createElement("img");
      img.src = diaryEntry.photoUrl;
      img.alt = "";
      polaroid.appendChild(img);
      flipFace.appendChild(polaroid);
    }

    if (diaryEntry) {
      const editBtn = document.createElement("button");
      editBtn.className = "diary-modal-edit-btn";
      editBtn.textContent = "\u270f\ufe0f Edit entry";
      editBtn.addEventListener("click", () => {
        dismiss();
        const reopenSheet = () => openMobileDiarySheet(userId, yearMonth, diaryDays, theme, d, true);
        openDiaryPage(d, window._currentEntry, yearMonth, userId, diaryEntry, reopenSheet, reopenSheet);
      });
      flipFace.appendChild(editBtn);
    } else {
      const writeBtn = document.createElement("button");
      writeBtn.className = "diary-modal-write-btn";
      writeBtn.textContent = "\u270f\ufe0f Write something";
      writeBtn.addEventListener("click", () => {
        dismiss();
        const reopenSheet = () => openMobileDiarySheet(userId, yearMonth, diaryDays, theme, d, true);
        openDiaryPage(d, window._currentEntry, yearMonth, userId, null, reopenSheet, reopenSheet);
      });
      flipFace.appendChild(writeBtn);
    }
  }

  function selectDay(d) {
    if (isFlipping) return;
    const prev = activeDay;
    activeDay = d;
    updateActivePip(d);

    // First load — no animation
    if (prev === null) {
      renderFaceContent(d);
      return;
    }

    // Determine direction
    const dir = d > prev ? "next" : "prev";
    const animClass = dir === "next" ? "flipping-next" : "flipping-prev";

    isFlipping = true;
    flipCard.classList.add(animClass);

    // Swap content at the midpoint (card is edge-on, invisible)
    setTimeout(() => {
      renderFaceContent(d);
    }, FLIP_SWAP_AT);

    // Release lock when animation ends
    flipCard.addEventListener("animationend", () => {
      flipCard.classList.remove(animClass);
      isFlipping = false;
    }, { once: true });
  }

  // ── Animate in ───────────────────────────────────────────
  requestAnimationFrame(() => {
    if (fadeIn) {
      overlay.style.transition = "opacity 0.4s ease";
      overlay.style.opacity = "1";
    } else {
      sheet.style.transition = "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)";
      sheet.style.transform = "translateY(0)";
    }
  });

  // ── Swipe-to-dismiss ─────────────────────────────────────
  let touchStartY = 0;
  let touchCurY = 0;
  sheet.addEventListener("touchstart", (e) => { touchStartY = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener("touchmove", (e) => {
    touchCurY = e.touches[0].clientY;
    const dy = touchCurY - touchStartY;
    if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  sheet.addEventListener("touchend", () => {
    const dy = touchCurY - touchStartY;
    if (dy > 80) {
      dismiss();
    } else {
      sheet.style.transition = "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)";
      sheet.style.transform = "translateY(0)";
    }
    touchStartY = 0;
    touchCurY = 0;
  });

  function dismiss() {
    sheet.style.transition = "transform 0.35s cubic-bezier(0.4, 0, 1, 1)";
    sheet.style.transform = "translateY(100%)";
    setTimeout(() => overlay.remove(), 370);
  }

  overlay.addEventListener("click", (e) => { if (e.target === overlay) dismiss(); });

  // ── Initial day ──────────────────────────────────────────
  const startDay = initialDay !== null
    ? initialDay
    : (isCurrentMonth ? todayDate : (diaryDays.size > 0 ? Math.max(...diaryDays) : daysInMonth));
  selectDay(startDay);
}
