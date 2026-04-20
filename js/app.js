import { auth } from "./firebase-config.js";
import { signIn, signOutUser, onAuthReady, hasCompletedSetup } from "./auth.js";
import { loadMyLog } from "./tracker-mylog.js";
import { loadAllLogs } from "./tracker-all.js";
import { loadFollowingLogs } from "./tracker-following.js";
import { getCurrentYearMonth, formatYearMonth, getPrevYearMonth, getNextYearMonth } from "./utils.js";
import { showToast, showLoader, hideLoader } from "./ui.js";
import { checkMonthlySetup } from "./month-setup.js";
import { getUserStats } from "./stats.js";
import { toggleMonthPicker, closeMonthPicker } from "./month-picker.js";
import { openPrivacySettingsModal } from "./privacy-settings.js";
import { getDiaryDays, getDiaryTheme } from "./diary.js";
import { openMobileDiarySheet } from "./diary-mobile.js";

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
    if (activeTab !== "mylog") monthBarStat.textContent = "";
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
  document.querySelectorAll(".sb-nav-item").forEach(btn => {
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
  closeAvatarMenu();

  const monthBar = document.getElementById("month-bar");
  if (monthBar) monthBar.style.display = (tab === "following" || tab === "all") ? "none" : "";

  tabMyLog.style.display     = tab === "mylog"     ? "block" : "none";
  tabFollowing.style.display = tab === "following" ? "grid"  : "none";
  tabAll.style.display       = tab === "all"       ? "block" : "none";

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

// Tab click handlers — mobile (Diary uses data-action; others use data-tab)
document.querySelectorAll(".bottom-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.dataset.tab) {
      switchTab(btn.dataset.tab);
    } else if (btn.dataset.action === "diary") {
      openDiaryFromNav();
    }
  });
});

// Open the mobile diary sheet from the bottom-nav Diary tab.
async function openDiaryFromNav() {
  if (!currentUser) return;
  try {
    const theme = await getDiaryTheme(currentUser.uid);
    const diaryDays = await getDiaryDays(currentUser.uid, activeYearMonth);
    openMobileDiarySheet(currentUser.uid, activeYearMonth, diaryDays, theme);
  } catch {
    showToast("Couldn't open diary. Try again.", "error");
  }
}

// Tab click handlers — desktop sidebar
document.querySelectorAll(".sb-nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.dataset.tab) {
      switchTab(btn.dataset.tab);
    } else if (btn.dataset.action) {
      showToast("coming soon.");
    }
  });
});

// ── Auth + sign in/out ────────────────────────
document.getElementById("google-signin-btn").addEventListener("click", signIn);
document.querySelectorAll("#signout-btn, #sb-signout-btn").forEach(el => {
  el.addEventListener("click", async () => {
    await signOutUser();
    showToast("Signed out!", "info");
  });
});

// ── Privacy settings ──────────────────────────
document.querySelectorAll("#privacy-settings-btn, #sb-privacy-btn").forEach(el => {
  el.addEventListener("click", () => {
    if (currentUser) openPrivacySettingsModal(currentUser);
  });
});

// ── Mobile header: Shop + Avatar menu ─────────
document.getElementById("header-shop-btn")?.addEventListener("click", () => {
  showToast("coming soon.");
});

const avatarBtn = document.getElementById("header-avatar-btn");
const avatarMenu = document.getElementById("avatar-menu");
let avatarMenuDismiss = null;

function closeAvatarMenu() {
  if (!avatarMenu || avatarMenu.hasAttribute("hidden")) return;
  avatarMenu.setAttribute("hidden", "");
  avatarBtn?.setAttribute("aria-expanded", "false");
  if (avatarMenuDismiss) {
    document.removeEventListener("click", avatarMenuDismiss);
    avatarMenuDismiss = null;
  }
}

function openAvatarMenu() {
  if (!avatarMenu) return;
  avatarMenu.removeAttribute("hidden");
  avatarBtn?.setAttribute("aria-expanded", "true");
  avatarMenuDismiss = (e) => {
    if (!avatarMenu.contains(e.target) && e.target !== avatarBtn && !avatarBtn.contains(e.target)) {
      closeAvatarMenu();
    }
  };
  setTimeout(() => document.addEventListener("click", avatarMenuDismiss), 0);
}

avatarBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (avatarMenu?.hasAttribute("hidden")) {
    openAvatarMenu();
  } else {
    closeAvatarMenu();
  }
});

// Close the menu when any action item fires (Privacy, Sign out).
avatarMenu?.querySelectorAll(".avatar-menu-item").forEach(btn => {
  btn.addEventListener("click", () => closeAvatarMenu());
});

// ── Side A / Side B theme pill ────────────────
// Two-segment pill in sidebar foot (desktop) and mobile header. An inline
// pre-paint script in index.html sets data-theme synchronously so Side B
// users see no flash. Here we handle persistence + aria-pressed sync.
const THEME_MIGRATE = { light: "side-a", dark: "side-b" };
const VALID_THEMES = new Set(["side-a", "side-b"]);
const themePillSegs = document.querySelectorAll(".theme-pill-seg");

const rawSaved = localStorage.getItem("theme");
const migrated = THEME_MIGRATE[rawSaved] || rawSaved;
const savedTheme = VALID_THEMES.has(migrated) ? migrated : "side-a";
document.documentElement.setAttribute("data-theme", savedTheme);
if (savedTheme !== rawSaved) localStorage.setItem("theme", savedTheme);

const syncThemePill = (theme) => {
  themePillSegs.forEach(el => {
    el.setAttribute("aria-pressed", el.dataset.themeSet === theme ? "true" : "false");
  });
};
syncThemePill(savedTheme);

themePillSegs.forEach(el => el.addEventListener("click", () => {
  const next = el.dataset.themeSet;
  if (!VALID_THEMES.has(next)) return;
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  syncThemePill(next);
}));

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
    appScreen.style.display   = "";
    userName.textContent      = user.displayName;
    const initial = (user.displayName || "?").charAt(0).toUpperCase();
    const sbUserName = document.getElementById("sb-user-name");
    if (sbUserName) sbUserName.textContent = user.displayName || "";
    const sbAvatar = document.getElementById("sb-avatar");
    if (sbAvatar) sbAvatar.textContent = initial;
    const headerAvatarInitial = document.getElementById("header-avatar-initial");
    if (headerAvatarInitial) headerAvatarInitial.textContent = initial;
    const menuAvatar = document.getElementById("avatar-menu-avatar");
    if (menuAvatar) menuAvatar.textContent = initial;
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
