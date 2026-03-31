import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentStep = 1;
let currentUser = null;

// State
const state = {
  displayName: "",
  activities: [],
  color: "#FF6B6B",
  font: "Inter",
  sticker: "🌻",
  marker: "circle"
};

// Wait for auth
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
  // Pre-fill display name from Google account
  document.getElementById("display-name-input").value = user.displayName || "";
  updatePreview();
});

// Progress bar
function updateProgress() {
  const fill = document.getElementById("progress-fill");
  const label = document.getElementById("step-label");
  fill.style.width = (currentStep / 4 * 100) + "%";
  label.textContent = `Step ${currentStep} of 4`;
}

// Show a step
function showStep(step) {
  document.querySelectorAll(".step").forEach(s => s.style.display = "none");
  document.getElementById(`step-${step}`).style.display = "block";
  document.getElementById("back-btn").style.display = step === 1 ? "none" : "inline-block";
  document.getElementById("next-btn").textContent = step === 4 ? "Finish ✓" : "Next →";
  updateProgress();
}

// Badge preview update
function updatePreview() {
  const nameEl = document.getElementById("preview-name");
  const stickerEl = document.getElementById("preview-sticker");
  const badge = document.getElementById("badge-preview");
  const nameInput = document.getElementById("display-name-input");

  if (nameEl) nameEl.textContent = nameInput?.value || "You";
  if (stickerEl) stickerEl.textContent = state.sticker;
  if (badge) {
    badge.style.background = state.color;
    badge.style.fontFamily = `'${state.font}', sans-serif`;
  }
}

// Color selection
document.querySelectorAll(".color-swatch").forEach(swatch => {
  swatch.addEventListener("click", () => {
    document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
    swatch.classList.add("selected");
    state.color = swatch.dataset.color;
    updatePreview();
  });
});

// Font selection
document.querySelectorAll(".font-option").forEach(option => {
  option.addEventListener("click", () => {
    document.querySelectorAll(".font-option").forEach(f => f.classList.remove("selected"));
    option.classList.add("selected");
    state.font = option.dataset.font;
    updatePreview();
  });
});

// Sticker selection
document.querySelectorAll(".sticker-option").forEach(option => {
  option.addEventListener("click", () => {
    document.querySelectorAll(".sticker-option").forEach(s => s.classList.remove("selected"));
    option.classList.add("selected");
    state.sticker = option.dataset.sticker;
    updatePreview();
  });
});

// Marker selection
document.querySelectorAll(".marker-option").forEach(option => {
  option.addEventListener("click", () => {
    document.querySelectorAll(".marker-option").forEach(m => m.classList.remove("selected"));
    option.classList.add("selected");
    state.marker = option.dataset.marker;
    document.getElementById("marker-preview-symbol").textContent = option.textContent;
  });
});

// Add activity button
let activityCount = 2;
document.getElementById("add-activity-btn").addEventListener("click", () => {
  if (activityCount >= 5) return;
  activityCount++;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "activity-input";
  input.placeholder = `Activity ${activityCount} (optional)`;
  input.maxLength = 20;
  document.getElementById("activities-list").appendChild(input);
  if (activityCount === 5) {
    document.getElementById("add-activity-btn").style.display = "none";
  }
});

// Display name input → live preview
document.getElementById("display-name-input").addEventListener("input", updatePreview);

// Validate each step
function validateStep(step) {
  if (step === 1) {
    const name = document.getElementById("display-name-input").value.trim();
    if (!name) { alert("Please enter a display name!"); return false; }
    state.displayName = name;
  }
  if (step === 2) {
    const inputs = document.querySelectorAll(".activity-input");
    const activities = Array.from(inputs)
      .map(i => i.value.trim())
      .filter(v => v !== "");
    if (activities.length === 0) { alert("Please add at least one activity!"); return false; }
    state.activities = activities;
  }
  return true;
}

// Next / Finish button
document.getElementById("next-btn").addEventListener("click", async () => {
  if (!validateStep(currentStep)) return;

  if (currentStep < 4) {
    currentStep++;
    showStep(currentStep);
  } else {
    // Save to Firestore
    await saveProfile();
  }
});

// Back button
document.getElementById("back-btn").addEventListener("click", () => {
  if (currentStep > 1) {
    currentStep--;
    showStep(currentStep);
  }
});

// Save profile to Firestore
async function saveProfile() {
  const btn = document.getElementById("next-btn");
  btn.textContent = "Saving...";
  btn.disabled = true;

  try {
    await setDoc(doc(db, "users", currentUser.uid), {
      displayName: state.displayName,
      email: currentUser.email,
      activities: state.activities,
      decoration: {
        color: state.color,
        font: state.font,
        sticker: state.sticker,
        marker: state.marker
      },
      setupComplete: true,
      createdAt: serverTimestamp(),
      setupLockedAt: serverTimestamp()
    });

    window.location.href = "index.html";
  } catch (error) {
    console.error("Error saving profile:", error);
    alert("Something went wrong. Please try again.");
    btn.textContent = "Finish ✓";
    btn.disabled = false;
  }
}

// Init
showStep(1);