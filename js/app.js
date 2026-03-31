import { auth } from "./firebase-config.js";
import { signIn, signOutUser, onAuthReady, hasCompletedSetup } from "./auth.js";
import { loadTracker } from "./tracker.js";
import { getCurrentYearMonth } from "./utils.js";
import { showToast, showLoader, hideLoader } from "./ui.js";

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const userName = document.getElementById("user-name");
const trackerContainer = document.getElementById("tracker-container");

document.getElementById("google-signin-btn").addEventListener("click", signIn);
document.getElementById("signout-btn").addEventListener("click", async () => {
  await signOutUser();
  showToast("Signed out!", "info");
});

// Show loader immediately while auth resolves
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
    hideLoader();
    await loadTracker(getCurrentYearMonth(), trackerContainer);
  } else {
    loginScreen.style.display = "flex";
    appScreen.style.display = "none";
    hideLoader();
  }
});