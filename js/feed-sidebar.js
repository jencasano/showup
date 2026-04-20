// feed-sidebar.js -- Pinned sidebar for the feed view

import { getPrivacy } from "./following-utils.js";
import { getActivityColor } from "./utils.js";

// ── Helpers ─────────────────────────────────────────

function actName(act) { return typeof act === "string" ? act : act.name; }

function todayDayNum() { return new Date().getDate(); }
function todayStr()    { return new Date().toISOString().slice(0, 10); }

function formatEventTime(ts) {
  if (!ts) return "";
  const ms = typeof ts === "number" ? ts : ts.toMillis ? ts.toMillis() : ts;
  const d = new Date(ms);
  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dDay = new Date(d);
  dDay.setHours(0, 0, 0, 0);
  if (dDay.getTime() === today.getTime()) return `today at ${timeStr}`;
  if (dDay.getTime() === yesterday.getTime()) return `yesterday at ${timeStr}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ` at ${timeStr}`;
}

// ── Stats computation ───────────────────────────────

export function computeFeedStats(model) {
  const day = todayDayNum();
  const today = todayStr();
  let activeToday = 0;
  let wroteDiary = 0;

  for (const uid of model.followingIds) {
    const log = model.logsCache[uid];
    if (log?.marks) {
      const hasMarkToday = Object.values(log.marks).some(days =>
        Array.isArray(days) && days.includes(day)
      );
      if (hasMarkToday) activeToday++;
    }
    if (model.diaryCache[uid]?.[today]) wroteDiary++;
  }

  return {
    activeToday,
    wroteDiary,
    followingCount: model.followingIds.length,
  };
}

// ── Pin card renderer ───────────────────────────────

function renderPinCard(uid, model) {
  const user = model.userCache[uid];
  const log  = model.logsCache[uid];
  if (!user) return null;

  const displayName = user.displayName || "Unknown";
  const privacy = getPrivacy(user);
  const tier = privacy.calendar;
  const deco = log?.decoration || user?.decoration || { color: "#C3342B", fontColor: "#FFFFFF" };

  const tierClass = {
    sharing:   "fsd-pin-card--sharing",
    followers: "fsd-pin-card--followers",
    lowkey:    "fsd-pin-card--lowkey",
    ghost:     "fsd-pin-card--ghost",
    private:   "fsd-pin-card--ghost",
  }[tier] || "fsd-pin-card--sharing";

  const card = document.createElement("div");
  card.className = `fsd-pin-card ${tierClass}`;

  // -- Top row: avatar + info --
  const top = document.createElement("div");
  top.className = "fsd-pin-top";

  const avatar = document.createElement("div");
  avatar.className = "fsd-pin-avatar";
  avatar.style.background = deco.color;
  avatar.style.color = deco.fontColor || "#FFFFFF";
  if (deco.avatarUrl) {
    const img = document.createElement("img");
    img.src = deco.avatarUrl;
    img.alt = displayName;
    avatar.appendChild(img);
  } else {
    avatar.textContent = displayName.charAt(0).toUpperCase();
  }

  const info = document.createElement("div");
  info.className = "fsd-pin-info";

  const nameRow = document.createElement("div");
  nameRow.className = "fsd-pin-name-row";

  const name = document.createElement("div");
  name.className = "fsd-pin-name";
  name.textContent = displayName;

  // Icon links
  const links = document.createElement("div");
  links.className = "fsd-pin-links";

  const calLink = document.createElement("div");
  calLink.className = "fsd-pin-link cal";
  calLink.title = "Calendar";
  calLink.textContent = "\uD83D\uDCC5";

  const diaryLink = document.createElement("div");
  diaryLink.className = "fsd-pin-link diary";
  diaryLink.title = "Diary";
  diaryLink.textContent = "\uD83D\uDCD3";

  const profileLink = document.createElement("div");
  profileLink.className = "fsd-pin-link profile";
  profileLink.title = "Profile (coming soon)";
  profileLink.textContent = "\uD83D\uDC64";

  links.append(calLink, diaryLink, profileLink);
  nameRow.append(name, links);

  // Sub line
  const sub = document.createElement("div");
  sub.className = "fsd-pin-sub";
  sub.textContent = buildSubLine(uid, model, tier);

  info.append(nameRow, sub);
  top.append(avatar, info);
  card.appendChild(top);

  // -- Activity legend or ghost text --
  if (tier === "ghost") {
    const ghost = document.createElement("div");
    ghost.className = "fsd-pin-ghost-text";
    ghost.textContent = "\uD83C\uDF19 Gone quiet for now.";
    card.appendChild(ghost);
  } else if (log?.activities && log.activities.length > 0) {
    const legend = document.createElement("div");
    legend.className = "fsd-pin-legend";
    const day = todayDayNum();

    for (let i = 0; i < log.activities.length; i++) {
      const act = log.activities[i];
      const aName = actName(act);
      const marks = log.marks?.[aName] || [];
      const loggedToday = marks.includes(day);

      const item = document.createElement("div");
      item.className = "fsd-pin-legend-item" + (loggedToday ? "" : " inactive");

      const dot = document.createElement("div");
      dot.className = "fsd-pin-legend-dot";
      dot.style.background = getActivityColor(i);

      const label = document.createElement("span");
      label.textContent = aName;

      item.append(dot, label);
      legend.appendChild(item);
    }

    card.appendChild(legend);
  }

  return card;
}

// ── Sub-line text ───────────────────────────────────

function buildSubLine(uid, model, tier) {
  if (tier === "ghost") return "Ghost";

  const today = todayStr();
  if (model.diaryCache[uid]?.[today]) return "wrote today";

  // Find most recent event for this user
  const lastEvt = model.feedEvents
    ?.filter(e => e.uid === uid)
    .sort((a, b) => (b.firedAt || 0) - (a.firedAt || 0))[0];

  if (lastEvt?.firedAt) return formatEventTime(lastEvt.firedAt);
  return "";
}

// ── Main sidebar renderer ───────────────────────────

export function renderFeedSidebar(container, model) {
  container.innerHTML = "";

  // Stats row
  const stats = computeFeedStats(model);
  const statsRow = document.createElement("div");
  statsRow.className = "fsd-stats";

  const statData = [
    { val: stats.activeToday, label: "Active\ntoday" },
    { val: stats.wroteDiary,  label: "Wrote\ndiary" },
    { val: stats.followingCount, label: "Following" },
  ];

  for (const s of statData) {
    const stat = document.createElement("div");
    stat.className = "fsd-stat";
    const num = document.createElement("div");
    num.className = "fsd-stat-num";
    num.textContent = s.val;
    const lbl = document.createElement("div");
    lbl.className = "fsd-stat-label";
    lbl.innerHTML = s.label.replace("\n", "<br>");
    stat.append(num, lbl);
    statsRow.appendChild(stat);
  }

  container.appendChild(statsRow);

  // Divider
  const divider = document.createElement("div");
  divider.className = "fsd-divider";
  container.appendChild(divider);

  // Pinned label
  const label = document.createElement("div");
  label.className = "fsd-pinned-label";
  label.textContent = "\uD83D\uDCCC Pinned";
  container.appendChild(label);

  // Pin cards
  const pinned = model.pinnedFollowingIds || [];

  if (pinned.length === 0) {
    const empty = document.createElement("div");
    empty.className = "fsd-pin-empty";
    empty.textContent = "Pin people from the People view.";
    container.appendChild(empty);
    return;
  }

  const maxVisible = 5;
  const visible = pinned.slice(0, maxVisible);

  for (const uid of visible) {
    const card = renderPinCard(uid, model);
    if (card) container.appendChild(card);
  }

  if (pinned.length > maxVisible) {
    const overflow = document.createElement("div");
    overflow.className = "fsd-pin-overflow";
    overflow.textContent = `+ ${pinned.length - maxVisible} more pinned`;
    container.appendChild(overflow);
  }
}
