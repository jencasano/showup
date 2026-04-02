import { auth } from "./firebase-config.js";
import { signIn, signOutUser, onAuthReady, hasCompletedSetup } from "./auth.js";
import { loadMyLog, loadAllLogs, loadFollowingLogs } from "./tracker.js";
import { getCurrentYearMonth, formatYearMonth, getPrevYearMonth, getNextYearMonth } from "./utils.js";
import { showToast, showLoader, hideLoader } from "./ui.js";
import { checkMonthlySetup } from "./month-setup.js";
import { getUserStats } from "./stats.js";
import { toggleMonthPicker, closeMonthPicker } from "./month-picker.js";

// ── Elements ──────────────────────────────────
const loginScreen  = document.getElementById("login-screen");
const appScreen    = document.getElementById("app-screen");
const userName     = document.getElementById("user-name");
const monthLabel   = document.getElementById("current-month-label");
const prevBtn      = document.getElementById("prev-month-btn");
const nextBtn      = document.getElementById("next-month-btn");
const calPickerBtn = document.getElementById("cal-picker-btn");
const monthBarStat = document.getElementById("month-bar-stat");
const tabMyLog     = document.getElementById("tab-mylog");
const tabFollowing = document.getElementById("tab-following");
const tabAll       = document.getElementById("tab-all");

let activeYearMonth   = getCurrentYearMonth();
let activeTab         = "mylog";
let currentUser       = null;
let allLogsUnsub      = null;
let followingUnsub    = null;

// ── Month nav ─────────────────────────────────
function updateMonthNav() {
  monthLabel.textContent = formatYearMonth(activeYearMonth);
  nextBtn.disabled = activeYearMonth >= getCurrentYearMonth();

  // Keep picker icon highlighted when viewing a non-current month
  calPickerBtn.classList.toggle("mp-btn-active", activeYearMonth !== getCurrentYearMonth());
}

async function changeMonth(yearMonth) {
  activeYearMonth = yearMonth;
  updateMonthNav();
  monthBarStat.textContent = "";
  await loadActiveTab();
  await updateStat();
}

prevBtn.addEventListener("click", () => changeMonth(getPrevYearMonth(activeYearMonth)));
nextBtn.addEventListener("click", () => {
  if (activeYearMonth < getCurrentYearMonth()) changeMonth(getNextYearMonth(activeYearMonth));
});

// ── Month Picker button ───────────────────────
calPickerBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleMonthPicker(calPickerBtn, activeYearMonth, (ym) => {
    if (ym !== activeYearMonth) changeMonth(ym);
  });
});

// ── Streak stat ───────────────────────────────
async function updateStat() {
  if (!currentUser || activeTab !== "mylog") {
    if (activeTab !== "following") monthBarStat.textContent = "";
    return;
  }
  const { streak, doneThisMonth, totalThisMonth } = await getUserStats(currentUser.uid, activeYearMonth);
  const parts = [];
  if (streak > 0) parts.push(`🔥 ${streak} day streak`);
  parts.push(`${doneThisMonth}/${totalThisMonth} days done`);
  monthBarStat.textContent = parts.join(" · ");
}

// ── Tab switching ─────────────────────────────
export function switchTab(tab) {
  activeTab = tab;

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(".bottom-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  tabMyLog.style.display     = tab === "mylog"     ? "block" : "none";
  tabFollowing.style.display = tab === "following" ? "grid"  : "none";
  tabAll.style.display       = tab === "all"       ? "grid"  : "none";

  if (tab !== "all" && allLogsUnsub) {
    allLogsUnsub();
    allLogsUnsub = null;
  }

  if (tab !== "following" && followingUnsub) {
    followingUnsub();
    followingUnsub = null;
    monthBarStat.textContent = "";
  }

  // Close picker when switching tabs
  closeMonthPicker();

  loadActiveTab();
  updateStat();
}

async function loadActiveTab() {
  if (activeTab === "mylog") {
    await loadMyLog(activeYearMonth, tabMyLog, currentUser);

  } else if (activeTab === "following") {
    if (followingUnsub) { followingUnsub(); followingUnsub = null; }
    followingUnsub = loadFollowingLogs(
      activeYearMonth,
      tabFollowing,
      currentUser,
      () => switchTab("all")
    );

  } else if (activeTab === "all") {
    if (allLogsUnsub) { allLogsUnsub(); allLogsUnsub = null; }
    allLogsUnsub = loadAllLogs(activeYearMonth, tabAll, currentUser);
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
