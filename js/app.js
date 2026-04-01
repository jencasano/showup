import { auth } from "./firebase-config.js";
import { signIn, signOutUser, onAuthReady, hasCompletedSetup } from "./auth.js";
import { loadTracker } from "./tracker.js";
import { getCurrentYearMonth, formatYearMonth, getPrevYearMonth, getNextYearMonth } from "./utils.js";
import { showToast, showLoader, hideLoader } from "./ui.js";
import { checkMonthlySetup } from "./month-setup.js";

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const userName = document.getElementById("user-name");
const trackerContainer = document.getElementById("tracker-container");
const currentMonthLabel = document.getElementById("current-month-label");
const prevBtn = document.getElementById("prev-month-btn");
const nextBtn = document.getElementById("next-month-btn");

let activeYearMonth = getCurrentYearMonth();

function updateMonthNav() {
  currentMonthLabel.textContent = formatYearMonth(activeYearMonth);
  nextBtn.disabled = activeYearMonth >= getCurrentYearMonth();
}

async function changeMonth(yearMonth) {
  activeYearMonth = yearMonth;
  updateMonthNav();
  loadTracker(activeYearMonth, trackerContainer);
}

prevBtn.addEventListener("click", () => changeMonth(getPrevYearMonth(activeYearMonth)));
nextBtn.addEventListener("click", () => {
  if (activeYearMonth < getCurrentYearMonth()) changeMonth(getNextYearMonth(activeYearMonth));
});

document.getElementById("google-signin-btn").addEventListener("click", signIn);
document.getElementById("signout-btn").addEventListener("click", async () => {
  await signOutUser();
  showToast("Signed out!", "info");
});

showLoader();

onAuthReady(async (user) => {
  if (user) {
    const setupDone = await hasCompletedSetup(user.uid);
    if (!setupDone) {
      window.location.href = "setup.html";
      return;
    }

    loginScreen.style.display = "none";
    appScreen.style.display = "block";
    userName.textContent = user.displayName;
    updateMonthNav();
    hideLoader();

    // Check if monthly setup needed — pass avatarUrl
    await checkMonthlySetup(user.uid, user.photoURL);

    // Load tracker with real-time listener
    loadTracker(activeYearMonth, trackerContainer);
  } else {
    loginScreen.style.display = "flex";
    appScreen.style.display = "none";
    hideLoader();
  }
});