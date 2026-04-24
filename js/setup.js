import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showMonthSetup } from "./month-setup.js";
import { DIARY_COVERS, DEFAULT_DIARY_COVER } from "./diary-covers.js";
import { renderMiniCover } from "./diary-picker.js";
import { seedEntitlementsIfMissing } from "./entitlements.js";

let currentUser = null;
const state = { step: 1, name: "", cover: DEFAULT_DIARY_COVER };

const nameInput      = document.getElementById("display-name-input");
const step1El        = document.getElementById("step-1");
const step2El        = document.getElementById("step-2");
const stepLabelEl    = document.getElementById("step-label");
const progressFillEl = document.getElementById("progress-fill");
const backBtn        = document.getElementById("back-btn");
const nextBtn        = document.getElementById("next-btn");
const coverGrid      = document.getElementById("cover-grid");
const pipEls         = document.querySelectorAll("#step-pips .step-pip");
const setupContainer = document.getElementById("setup-container");
const handoffScreen  = document.getElementById("handoff-screen");
const planMonthBtn   = document.getElementById("plan-month-btn");
const planMonthName  = document.getElementById("plan-month-name");

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "index.html"; return; }
  currentUser = user;
  state.name = user.displayName || "";
  nameInput.value = state.name;
  planMonthName.textContent = new Date().toLocaleString("default", { month: "long" });
  history.replaceState({ step: 1, name: state.name, cover: state.cover }, "", "");
  renderStep(1);
});

function renderStep(n) {
  state.step = n;

  step1El.classList.toggle("step--active", n === 1);
  step2El.classList.toggle("step--active", n === 2);
  setupContainer.classList.toggle("setup-mode-step-2", n === 2);
  stepLabelEl.textContent = `Step ${n} of 2`;
  progressFillEl.style.width = n === 1 ? "50%" : "100%";

  pipEls.forEach((pip, i) => {
    pip.classList.toggle("step-pip--active", i === n - 1);
  });

  backBtn.hidden = (n === 1);
  nextBtn.textContent = n === 2 ? "Continue, →" : "Next, →";

  if (n === 2 && !coverGrid.hasChildNodes()) {
    renderCoverGrid();
  }
  if (n === 2) {
    highlightSelectedCover();
  }
}

function renderCoverGrid() {
  coverGrid.innerHTML = "";
  for (const key of Object.keys(DIARY_COVERS)) {
    const cover = DIARY_COVERS[key];
    const slot = document.createElement("button");
    slot.className = "setup-cover-slot";
    slot.type = "button";
    slot.dataset.cover = key;

    const mini = renderMiniCover(key, { width: 140, height: 180 });
    slot.appendChild(mini);

    const meta = document.createElement("div");
    meta.className = "setup-cover-slot-meta";
    const name = document.createElement("div");
    name.className = "setup-cover-slot-name";
    name.textContent = cover.displayName;
    const sub = document.createElement("div");
    sub.className = "setup-cover-slot-sub";
    sub.textContent = cover.materialLabel;
    meta.appendChild(name);
    meta.appendChild(sub);
    slot.appendChild(meta);

    slot.addEventListener("click", () => {
      state.cover = key;
      highlightSelectedCover();
    });

    coverGrid.appendChild(slot);
  }
  highlightSelectedCover();
}

function highlightSelectedCover() {
  coverGrid.querySelectorAll(".setup-cover-slot").forEach(slot => {
    slot.classList.toggle("setup-cover-slot--selected", slot.dataset.cover === state.cover);
  });
}

nextBtn.addEventListener("click", async () => {
  if (state.step === 1) {
    const name = nameInput.value.trim();
    if (!name) { alert("Please enter a display name!"); return; }
    state.name = name;
    history.pushState({ step: 2, name, cover: state.cover }, "", "");
    renderStep(2);
    return;
  }

  // Step 2 → save + handoff
  nextBtn.textContent = "Saving...";
  nextBtn.disabled = true;
  backBtn.disabled = true;

  try {
    await setDoc(doc(db, "users", currentUser.uid), {
      displayName: state.name,
      email: currentUser.email,
      diaryCover: state.cover,
      setupComplete: true,
      createdAt: serverTimestamp()
    });
    await seedEntitlementsIfMissing(currentUser.uid);
    history.pushState({ step: "handoff", name: state.name, cover: state.cover }, "", "");
    renderHandoff();
  } catch (error) {
    console.error("Error saving profile:", error);
    alert("Something went wrong. Please try again.");
    nextBtn.textContent = "Continue, →";
    nextBtn.disabled = false;
    backBtn.disabled = false;
  }
});

backBtn.addEventListener("click", () => {
  if (state.step === 2) history.back();
});

window.addEventListener("popstate", (e) => {
  const s = e.state?.step ?? 1;
  if (s === 1) {
    nameInput.value = e.state?.name ?? state.name;
    state.name = nameInput.value;
    setupContainer.hidden = false;
    handoffScreen.hidden = true;
    renderStep(1);
  } else if (s === 2) {
    if (e.state?.name) { state.name = e.state.name; nameInput.value = e.state.name; }
    setupContainer.hidden = false;
    handoffScreen.hidden = true;
    renderStep(2);
  } else if (s === "handoff") {
    renderHandoff();
  }
});

function renderHandoff() {
  setupContainer.hidden = true;
  handoffScreen.hidden = false;
  // Let the browser commit the hidden swap before starting the entry animation.
  requestAnimationFrame(() => {
    handoffScreen.classList.add("handoff-screen--enter");
  });
}

planMonthBtn.addEventListener("click", async () => {
  planMonthBtn.disabled = true;
  handoffScreen.classList.add("handoff-screen--exit");
  try {
    await showMonthSetup(currentUser.uid, currentUser.photoURL, null, state.name);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Error running monthly setup:", error);
    alert("Something went wrong. Please try again.");
    handoffScreen.classList.remove("handoff-screen--exit");
    planMonthBtn.disabled = false;
  }
});
