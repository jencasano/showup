import { auth } from "./firebase-config.js";
import { signIn, signOutUser, onAuthReady, hasCompletedSetup } from "./auth.js";
import { loadMyLog, loadAllLogs, loadFollowingLogs } from "./tracker.js";
import { getCurrentYearMonth, formatYearMonth, getPrevYearMonth, getNextYearMonth } from "./utils.js";
import { showToast, showLoader, hideLoader } from "./ui.js";
import { checkMonthlySetup } from "./month-setup.js";
import { getUserStats } from "./stats.js";
import { toggleMonthPicker, closeMonthPicker } from "./month-picker.js";
import { icon } from "./icons.js";

// ── Elements ──────────────────────────────────
const loginScreen  = document.getElementById("login-screen");
const appScreen    = document.getElementById("app-screen");
const userName     = document.getElementById("user-name");
const monthLabel   = document.getElementById("current-month-label");
const prevBtn      = document.getElementById("prev-month-btn");
const nextBtn      = document.getElementById("next-month-btn");
const calPickerBtn = document.getElementById("cal-picker-btn");
const todayBtn     = document.getElementById("today-btn");
const monthBarStat = document.getElementById("month-bar-stat");
const tabMyLog     = document.getElementById("tab-mylog");
const tabFollowing = document.getElementById("tab-following");
const tabAll       = document.getElementById("tab-all");

let activeYearMonth   = getCurrentYearMonth();
let activeTab         = "mylog";
let currentUser       = null;
let allLogsUnsub      = null;
let followingUnsub    = null;
let myLogStatsCacheKey = "";
let myLogStatsPromise = null;

function getMyLogStatsPromise() {
  if (!currentUser) return Promise.resolve(null);
  const key = `${currentUser.uid}:${activeYearMonth}`;
  if (myLogStatsCacheKey !== key || !myLogStatsPromise) {
    myLogStatsCacheKey = key;
    myLogStatsPromise = getUserStats(currentUser.uid, activeYearMonth);
  }
  return myLogStatsPromise;
}

function resetMyLogStatsCache() {
  myLogStatsCacheKey = "";
  myLogStatsPromise = null;
}

// ── Month nav ─────────────────────────────────
function updateMonthNav() {
  const currentYM = getCurrentYearMonth();
  const isPast    = activeYearMonth !== currentYM;

  monthLabel.textContent = formatYearMonth(activeYearMonth);
  nextBtn.disabled = activeYearMonth >= currentYM;

  // 📅 picker: highlight when viewing a past month
  calPickerBtn.classList.toggle("mp-btn-active", isPast);

  // 🎯 today button: only visible when not on current month
  todayBtn.hidden = !isPast;
  todayBtn.title  = isPast ? `Back to ${formatYearMonth(currentYM)}` : "";
}

async function changeMonth(yearMonth) {
  activeYearMonth = yearMonth;
  resetMyLogStatsCache();
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

// ── Today / current-month button ─────────────
todayBtn.addEventListener("click", () => {
  changeMonth(getCurrentYearMonth());
});

// ── Streak stat ───────────────────────────────
async function updateStat() {
  if (!currentUser || activeTab !== "mylog") {
    if (activeTab !== "following") monthBarStat.textContent = "";
    return;
  }
  const stats = await getMyLogStatsPromise();
  if (!stats) return;
  const { streak } = stats;
  const parts = [];
  if (streak > 0) parts.push(`🔥 ${streak} day streak`);
  monthBarStat.textContent = parts.join(" · ");
}

// ── Tab switching ─────────────────────────────
export function switchTab(tab) {
  activeTab = tab;
  if (tab === "mylog") {
    resetMyLogStatsCache();
  }

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(".bottom-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  if (tab !== "all" && allLogsUnsub) {
    allLogsUnsub();
    allLogsUnsub = null;
  }

  if (tab !== "following" && followingUnsub) {
    followingUnsub();
    followingUnsub = null;
    monthBarStat.textContent = "";
  }

  closeMonthPicker();

  tabMyLog.style.display     = tab === "mylog"     ? "block" : "none";
  tabFollowing.style.display = tab === "following" ? "grid"  : "none";
  tabAll.style.display       = tab === "all"       ? "grid"  : "none";

  const activePanel = tab === "mylog" ? tabMyLog
    : tab === "following" ? tabFollowing : tabAll;
  activePanel.style.animation = "none";
  activePanel.offsetHeight;
  activePanel.style.animation = "";

  loadActiveTab(true);
  updateStat();
}

async function loadActiveTab(silent = false) {
  if (activeTab === "mylog") {
    await loadMyLog(activeYearMonth, tabMyLog, currentUser, getMyLogStatsPromise(), silent);

  } else if (activeTab === "following") {
    if (followingUnsub) { followingUnsub(); followingUnsub = null; }
    followingUnsub = loadFollowingLogs(
      activeYearMonth,
      tabFollowing,
      currentUser,
      () => switchTab("all"),
      silent
    );

  } else if (activeTab === "all") {
    if (allLogsUnsub) { allLogsUnsub(); allLogsUnsub = null; }
    allLogsUnsub = loadAllLogs(activeYearMonth, tabAll, currentUser, silent);
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
themeToggle.innerHTML = icon(savedTheme === "dark" ? "sun" : "moon", 16);

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  themeToggle.innerHTML = icon(next === "dark" ? "sun" : "moon", 16);
});

// ── Auth state ────────────────────────────────
showLoader();

onAuthReady(async (user) => {
  if (user) {
    currentUser = user;
    resetMyLogStatsCache();
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
