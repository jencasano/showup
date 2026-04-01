import { auth } from "./firebase-config.js";
import { signIn, signOutUser, onAuthReady, hasCompletedSetup } from "./auth.js";
import { loadMyLog } from "./tracker.js";
import { getCurrentYearMonth, formatYearMonth, getPrevYearMonth, getNextYearMonth } from "./utils.js";
import { showToast, showLoader, hideLoader } from "./ui.js";
import { checkMonthlySetup } from "./month-setup.js";
import { getUserStats } from "./stats.js";

// ── Elements ──────────────────────────────────
const loginScreen  = document.getElementById("login-screen");
const appScreen    = document.getElementById("app-screen");
const userName     = document.getElementById("user-name");
const monthLabel   = document.getElementById("current-month-label");
const prevBtn      = document.getElementById("prev-month-btn");
const nextBtn      = document.getElementById("next-month-btn");
const monthBarStat = document.getElementById("month-bar-stat");
const tabMyLog     = document.getElementById("tab-mylog");
const tabFollowing = document.getElementById("tab-following");
const tabAll       = document.getElementById("tab-all");

let activeYearMonth = getCurrentYearMonth();
let activeTab       = "mylog";
let currentUser     = null;

// ── Month nav ─────────────────────────────────
function updateMonthNav() {
  monthLabel.textContent = formatYearMonth(activeYearMonth);
  nextBtn.disabled = activeYearMonth >= getCurrentYearMonth();
}

async function changeMonth(yearMonth) {
  activeYearMonth = yearMonth;
  updateMonthNav();
  monthBarStat.textContent = ""; // clear stat while loading
  await loadActiveTab();
  await updateStat();
}

prevBtn.addEventListener("click", () => changeMonth(getPrevYearMonth(activeYearMonth)));
nextBtn.addEventListener("click", () => {
  if (activeYearMonth < getCurrentYearMonth()) changeMonth(getNextYearMonth(activeYearMonth));
});

// ── Streak stat ───────────────────────────────
async function updateStat() {
  if (!currentUser || activeTab !== "mylog") {
    monthBarStat.textContent = "";
    return;
  }
  const { streak, doneThisMonth, totalThisMonth } = await getUserStats(currentUser.uid, activeYearMonth);
  const parts = [];
  if (streak > 0) parts.push(`🔥 ${streak} day streak`);
  parts.push(`${doneThisMonth}/${totalThisMonth} days done`);
  monthBarStat.textContent = parts.join(" · ");
}

// ── Tab switching ─────────────────────────────
function switchTab(tab) {
  activeTab = tab;

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  document.querySelectorAll(".bottom-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  tabMyLog.style.display     = tab === "mylog"     ? "block" : "none";
  tabFollowing.style.display = tab === "following" ? "block" : "none";
  tabAll.style.display       = tab === "all"       ? "block" : "none";

  loadActiveTab();
  updateStat();
}

async function loadActiveTab() {
  if (activeTab === "mylog") {
    await loadMyLog(activeYearMonth, tabMyLog, currentUser);
  } else if (activeTab === "following") {
    tabFollowing.innerHTML = `<p class="empty-state">Following tab — coming soon! 👀</p>`;
  } else if (activeTab === "all") {
    tabAll.innerHTML = `<p class="empty-state">All tab — coming soon! 👀</p>`;
  }
}

// Tab click handlers — desktop
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// Tab click handlers — mobile
document.querySelectorAll(".bottom-tab").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// ── Auth + sign in/out ────────────────────────
document.getElementById("google-signin-btn").addEventListener("click", signIn);
document.getElementById("signout-btn").addEventListener("click", async () => {
  await signOutUser();
  showToast("Signed out!", "info");
});

// ── Dark mode toggle ──────────────────────────
const themeToggle = document.getElementById("theme-toggle");
const savedTheme  = localStorage.getItem("theme") || "light";
document.documentElement.setAttribute("data-theme", savedTheme);
themeToggle.textContent = savedTheme === "dark" ? "☀️" : "🌙";

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  themeToggle.textContent = next === "dark" ? "☀️" : "🌙";
});

// ── Auth state ────────────────────────────────
showLoader();

onAuthReady(async (user) => {
  if (user) {
    currentUser = user;
    const setupDone = await hasCompletedSetup(user.uid);
    if (!setupDone) {
      window.location.href = "setup.html";
      return;
    }

    loginScreen.style.display = "none";
    appScreen.style.display   = "block";
    userName.textContent      = user.displayName;
    updateMonthNav();
    hideLoader();

    await checkMonthlySetup(user.uid, user.photoURL);
    await loadActiveTab();
    await updateStat();
  } else {
    loginScreen.style.display = "flex";
    appScreen.style.display   = "none";
    hideLoader();
  }
});
