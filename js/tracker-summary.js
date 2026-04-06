import { getDaysInMonth, getActivityColor } from "./utils.js";
import { showToast } from "./ui.js";
import { icon } from "./icons.js";

function monthName(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function renderMonthlySummary(entry, stats, yearMonth, isCurrentMonth) {
  const { showUpDays = 0, perfectDays = 0, totalThisMonth, habitStats, monthlyTargetHitRate, fullWeeksCount, joinDay = null } = stats;
  const activities = entry.activities || [];
  const [year, month] = yearMonth.split("-").map(Number);
  const mName = new Date(year, month - 1, 1).toLocaleString("default", { month: "long" });

  const card = document.createElement("div");
  card.className = "summary-card";

  const barsHTML = habitStats.map((h, i) => {
    const color = getActivityColor(i);
    const displayRate = h.monthRate;
    const barColor = displayRate >= 100 ? "var(--color-success, #22C55E)"
      : displayRate >= 70 ? "var(--color-warning, #F59E0B)"
      : "var(--color-danger, #EF4444)";
    const statusPill = h.extra > 0
      ? `<span class="summary-habit-streak">\u2705 Target met (+${h.extra} extra)</span>`
      : h.monthLogged >= h.monthTarget
        ? `<span class="summary-habit-streak">\u2705 Target met</span>`
        : `<span class="summary-habit-streak">${h.monthTarget - h.monthLogged} to go</span>`;
    const pctClass = `summary-habit-pct${h.extra > 0 ? " summary-habit-pct--over" : ""}`;
    const pctStyle = h.extra > 0 ? "" : `style="color:${barColor}"`;

    const paceBadgeClass = {
      ahead:      "pace-badge--ahead",
      "on-track": "pace-badge--on-track",
      behind:     "pace-badge--behind",
      early:      "pace-badge--early",
      started:    "pace-badge--started"
    }[h.paceKey] || "";

    return `
      <div class="summary-habit-row">
        <div class="summary-habit-top">
          <span class="summary-habit-name">
            <span class="summary-habit-dot" style="background:${color}"></span>
            ${h.name}
          </span>
          <div class="summary-habit-meta">
            ${statusPill}
            <span class="summary-habit-cad">${h.cadenceLabel}</span>
            <span class="${pctClass}" ${pctStyle}>${h.monthLogged}/${h.monthTarget}</span>
          </div>
        </div>
        <div class="summary-habit-track">
          <div class="summary-habit-fill" style="width:${displayRate}%;background:${barColor}"></div>
        </div>
        <div class="summary-habit-sub">
          <span class="pace-badge ${paceBadgeClass}">${h.paceLabel}</span>
          <span class="pace-message">${h.paceMessage}</span>
        </div>
      </div>`;
  }).join("");

  const joinedThisMonth = (() => {
    const jd = entry.joinDate instanceof Date ? entry.joinDate : entry.joinDate ? new Date(entry.joinDate) : null;
    if (!jd) return false;
    const jYM = `${jd.getFullYear()}-${String(jd.getMonth() + 1).padStart(2, "0")}`;
    return jYM === yearMonth;
  })();
  const calendarHTML = renderFullWeekCalendar(entry, habitStats, yearMonth, fullWeeksCount, joinDay, joinedThisMonth);

  card.innerHTML = `
    <div class="summary-card__header">
      <div>
        <div class="summary-card__title">My Progress</div>
        <div class="summary-card__sub">${activities.length} habit${activities.length !== 1 ? "s" : ""} \u00b7 ${mName} ${year}</div>
      </div>
      <button class="summary-share-btn" title="Share your stats">\u2197 Share</button>
    </div>
    <div class="summary-stats">
      <div class="summary-stat">
        <span class="summary-stat__icon">${icon('target', 28)}</span>
        <div class="summary-stat__val">${monthlyTargetHitRate}<span class="summary-stat__unit">%</span></div>
        <div class="summary-stat__label">
          <span class="summary-stat__label-text">Targeted Habits Completed</span>
          <span class="summary-stat__help-wrap">
            <button class="summary-stat__help-btn" type="button" aria-label="About targeted habits completed" aria-expanded="false">i</button>
            <span class="summary-stat__tooltip" role="tooltip">
              <span>The percentage of your habits that have already reached their monthly target.</span>
            </span>
          </span>
        </div>
      </div>
      <div class="summary-stat">
        <span class="summary-stat__icon">${icon('sparkle', 28)}</span>
        <div class="summary-stat__val">${perfectDays}/${totalThisMonth}</div>
        <div class="summary-stat__label">
          <span class="summary-stat__label-text">Perfect Days</span>
          <span class="summary-stat__help-wrap">
            <button class="summary-stat__help-btn" type="button" aria-label="About perfect days" aria-expanded="false">i</button>
            <span class="summary-stat__tooltip" role="tooltip">
              <span>Days you completed every habit.</span>
            </span>
          </span>
        </div>
      </div>
      <div class="summary-stat">
        <span class="summary-stat__icon">${icon('sunflower', 28)}</span>
        <div class="summary-stat__val">${showUpDays}/${totalThisMonth}</div>
        <div class="summary-stat__label">
          <span class="summary-stat__label-text">Show-Up Days</span>
          <span class="summary-stat__help-wrap">
            <button class="summary-stat__help-btn" type="button" aria-label="About show-up days" aria-expanded="false">i</button>
            <span class="summary-stat__tooltip" role="tooltip">
              <span>Days you logged at least one habit.</span>
            </span>
          </span>
        </div>
      </div>
    </div>
    <div class="summary-note">
      Your monthly goals are based on how often per week you want to show up. You set the bar. Now go hit it.
    </div>
    <div class="summary-habits">
      <div class="summary-habits__label">This Month's Progress</div>
      <div class="summary-habits-grid">
        <div class="summary-habits-grid__left">
          ${barsHTML}
        </div>
        <div class="summary-habits-grid__right">
          ${calendarHTML}
        </div>
      </div>
    </div>
  `;

  card.querySelector(".summary-share-btn").addEventListener("click", () => {
    const text = `My showup. stats for ${mName} ${year}:\n\ud83c\udfaf ${monthlyTargetHitRate}% targeted habits completed\n\u2728 ${perfectDays}/${totalThisMonth} perfect days\n\ud83d\udcc5 ${showUpDays}/${totalThisMonth} show-up days\n${habitStats.map(h => `\u2022 ${h.name}: ${h.monthLogged}/${h.monthTarget} this month${h.extra > 0 ? ` (+${h.extra} extra)` : ""}`).join("\n")}`;
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => showToast("Stats copied!", "info"));
    }
  });

  const statHelpWraps = Array.from(card.querySelectorAll(".summary-stat__help-wrap"));
  const closeStatTooltips = () => {
    statHelpWraps.forEach((wrap) => {
      wrap.classList.remove("is-open");
      const btn = wrap.querySelector(".summary-stat__help-btn");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  };

  card.querySelectorAll(".summary-stat__help-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const wrap = btn.closest(".summary-stat__help-wrap");
      if (!wrap) return;
      const willOpen = !wrap.classList.contains("is-open");
      closeStatTooltips();
      if (willOpen) {
        wrap.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });

  card.addEventListener("click", (e) => {
    if (!e.target.closest(".summary-stat__help-wrap")) closeStatTooltips();
  });

  card.querySelectorAll(".fw-day[data-overflow]").forEach(dayEl => {
    dayEl.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll(".fw-popover").forEach(p => p.remove());
      const allHabits = JSON.parse(dayEl.dataset.overflow);
      const pop = document.createElement("div");
      pop.className = "fw-popover";
      pop.innerHTML = allHabits.map(h =>
        `<span class="fw-popover-item"><i style="background:${h.color};width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:4px;flex-shrink:0;"></i>${h.name}</span>`
      ).join("");
      dayEl.appendChild(pop);
      setTimeout(() => {
        document.addEventListener("click", () => pop.remove(), { once: true });
      }, 0);
    });
  });

  return card;
}

function renderFullWeekCalendar(entry, habitStats, yearMonth, fullWeeksCount, joinDay = null, joinedThisMonth = false) {
  const [year, month] = yearMonth.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const daysInMonth = getDaysInMonth(yearMonth);
  const mondayOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month - 1, 1 - mondayOffset);
  const weekRows = [];

  for (let week = 0; week < 6; week++) {
    const row = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + week * 7 + d);
      row.push(date);
    }
    weekRows.push(row);
  }

  const marks = entry.marks || {};

  const fullWeekByStart = new Map();
  habitStats.forEach(h => {
    (h.fullWeeksBreakdown || []).forEach((w) => {
      if (!fullWeekByStart.has(w.label)) fullWeekByStart.set(w.label, []);
      fullWeekByStart.get(w.label).push({ name: h.name, logged: w.logged, target: w.target, hit: w.hit });
    });
  });

  const colorByName = {};
  habitStats.forEach((h, i) => { colorByName[h.name] = getActivityColor(i); });

  const MAX_DOTS = 5;

  let fullWeekOrdinal = 0;
  const weekBlocks = weekRows.map((row) => {
    const inMonth = row.filter(d => d.getMonth() === (month - 1));
    const isFullInMonthWeek = inMonth.length === 7 && (joinDay == null || row[0].getDate() >= joinDay);
    const weekLabel = isFullInMonthWeek ? `Wk${++fullWeekOrdinal}` : null;

    const badgeRows = (fullWeekByStart.get(weekLabel) || []).map(w => {
      const state = w.hit ? "hit" : (w.logged >= Math.max(1, w.target - 1) ? "close" : "miss");
      const color = colorByName[w.name] || "#888";
      return `<span class="fw-badge fw-badge--${state}"><i class="fw-badge-dot" style="background:${color}"></i>${w.name} ${w.logged}/${w.target}</span>`;
    }).join("");

    const dayCells = row.map(date => {
      const inCurrent = date.getMonth() === (month - 1);
      const dayNum = date.getDate();

      if (!inCurrent) {
        return `<div class="fw-day fw-day--muted"><span class="fw-day-num">${dayNum}</span></div>`;
      }

      const loggedHabits = habitStats
        .map((h, i) => ({ name: h.name, color: getActivityColor(i) }))
        .filter(h => (marks[h.name] || []).includes(dayNum));

      const visibleDots = loggedHabits.slice(0, MAX_DOTS);
      const hasOverflow = loggedHabits.length > MAX_DOTS;

      const dotsHTML = visibleDots.map(h =>
        `<i class="fw-habit-dot" style="background:${h.color}"></i>`
      ).join("") + (hasOverflow ? `<i class="fw-habit-dot fw-habit-dot--more">+${loggedHabits.length - MAX_DOTS}</i>` : "");

      const overflowAttr = hasOverflow
        ? ` data-overflow='${JSON.stringify(loggedHabits).replace(/'/g, "&#39;")}'`
        : "";

      const joinIndicatorHTML = (joinDay != null && dayNum === joinDay)
        ? `<span class="fw-join-indicator"><img src="/assets/icons/join-date.svg" width="10" height="10" alt="" /><span class="fw-join-label">${joinedThisMonth ? "Joined" : "Started"}</span></span>`
        : "";

      return `<div class="fw-day${hasOverflow ? " fw-day--has-overflow" : ""}"${overflowAttr}><span class="fw-day-num">${dayNum}</span>${joinIndicatorHTML}${dotsHTML ? `<div class="fw-day-dots">${dotsHTML}</div>` : ""}</div>`;
    }).join("");

    if (isFullInMonthWeek) {
      return `<div class="fw-week fw-week--full"><div class="fw-week-grid">${dayCells}</div><div class="fw-badges">${badgeRows}</div></div>`;
    }
    return `<div class="fw-week"><div class="fw-week-grid">${dayCells}</div></div>`;
  }).join("");

  const legendHTML = `
    <div class="fw-legend">
      <span class="fw-legend-pill fw-badge fw-badge--hit">Target hit</span>
      <span class="fw-legend-pill fw-badge fw-badge--close">Close</span>
      <span class="fw-legend-pill fw-badge fw-badge--miss">Missed</span>
    </div>`;

  const calendarHTML = `
    <div class="fullweek-calendar">
      <div class="fullweek-calendar__title">${monthName(yearMonth)}</div>
      <div class="fullweek-calendar__sub">Full-week cadence view (Monday to Sunday)</div>
      <div class="fw-dow"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
      ${weekBlocks}
      ${legendHTML}
    </div>`;

  if (fullWeeksCount === 0) {
    const [y, m] = yearMonth.split("-").map(Number);
    const nextMonthName = new Date(y, m, 1).toLocaleDateString("en-US", { month: "long" });
    const joinedOnHTML = joinDay != null
      ? `<span class="fw-overlay-join-note">You joined on ${new Date(y, m - 1, joinDay).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.</span>`
      : "";
    return `
      <div class="fullweek-calendar-wrap fw-has-empty-overlay">
        ${calendarHTML}
        <div class="fw-empty-overlay">
          <h4>No full weeks this month.</h4>
          <p>Joined late? Fair. Show up in ${nextMonthName} and we'll clock every win.</p>
          ${joinedOnHTML}
        </div>
      </div>`;
  }

  return `<div class="fullweek-calendar-wrap">${calendarHTML}</div>`;
}
