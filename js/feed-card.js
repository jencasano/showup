import { getPrivacy, renderTierBadge } from "./following-utils.js";
import { computeSignal, pickCopy } from "./following-signals.js";
import { renderDiaryStrip } from "./diary-strip.js";
import { db } from "./firebase-config.js";
import { doc, setDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast } from "./ui.js";
import { getActivityColor } from "./utils.js";

function formatYearMonth(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

// Activities may be strings or objects — normalise to { name, color }
function actName(act) { return typeof act === "string" ? act : act.name; }
function actColor(act, i) { return (typeof act === "object" && act.color) ? act.color : getActivityColor(i); }

function buildZoneLblRow(labelText, labelClass, tierBadge) {
  const row = document.createElement("div");
  row.className = "fw-feed-zone-lbl-row";
  const lbl = document.createElement("div");
  lbl.className = labelClass;
  lbl.textContent = labelText;
  row.append(lbl, tierBadge);
  return row;
}

export function renderFeedCard(uid, user, log, diaryEntry, yearMonth, currentUser, options = {}) {
  const displayName = user?.displayName || "Unknown";
  const privacy = getPrivacy(user);
  const signal = computeSignal(displayName, log);
  const deco = log?.decoration || user?.decoration || { color: "#D8584E", fontColor: "#FFFFFF" };
  const initial = displayName.charAt(0).toUpperCase();

  const dateStr = new Date().toISOString().slice(0, 10);

  const card = document.createElement("div");
  card.className = "fw-feed-card";

  // ── Header ──
  const head = document.createElement("div");
  head.className = "fw-feed-card-head";

  const avatar = document.createElement("div");
  avatar.className = "fw-feed-card-avatar";
  avatar.style.background = deco.color;
  avatar.style.color = deco.fontColor || "#FFFFFF";
  if (deco.avatarUrl) {
    const img = document.createElement("img");
    img.src = deco.avatarUrl;
    img.alt = displayName;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.borderRadius = "50%";
    img.style.objectFit = "cover";
    avatar.appendChild(img);
  } else {
    avatar.textContent = initial;
  }

  const nameCol = document.createElement("div");
  const nameEl = document.createElement("div");
  nameEl.className = "fw-feed-card-name";
  nameEl.textContent = displayName;
  const whenEl = document.createElement("div");
  whenEl.className = "fw-feed-card-when";
  whenEl.textContent = formatYearMonth(yearMonth);
  nameCol.append(nameEl, whenEl);

  head.append(avatar, nameCol);
  card.appendChild(head);

  // ── Body ──
  const tier = privacy.calendar;

  if (tier === "ghost") {
    if (privacy.diary === "ghost") {
      card.style.opacity = "0.55";
    }

    // Cal zone -- ghost
    const calZone = document.createElement("div");
    calZone.className = "fw-feed-cal-zone";
    if (privacy.diary !== "ghost") {
      calZone.classList.add("fw-feed-zone-ghost");
    }
    calZone.appendChild(buildZoneLblRow("ACTIVITY", "fw-feed-section-lbl", renderTierBadge(privacy.calendar)));
    const ghostCal = document.createElement("div");
    ghostCal.style.textAlign = "center";
    const moon1 = document.createElement("div");
    moon1.style.fontSize = "1.4rem";
    moon1.textContent = "\uD83C\uDF19";
    const txt1 = document.createElement("div");
    txt1.style.color = "var(--text-faint)";
    txt1.style.fontStyle = "italic";
    txt1.style.fontSize = "0.82rem";
    txt1.textContent = pickCopy(["ghost_cal_1","ghost_cal_2","ghost_cal_3","ghost_cal_4"], uid, dateStr);
    ghostCal.append(moon1, txt1);
    calZone.appendChild(ghostCal);
    card.appendChild(calZone);

    // Divider
    const div1 = document.createElement("div");
    div1.className = "fw-feed-zone-divider";
    card.appendChild(div1);

    // Diary zone -- ghost (based on privacy.diary)
    const diaryZone = document.createElement("div");
    diaryZone.className = "fw-feed-diary-zone";
    diaryZone.appendChild(buildZoneLblRow("diary.", "fw-feed-diary-lbl", renderTierBadge(privacy.diary)));
    if (privacy.diary === "ghost") {
      const moon2 = document.createElement("div");
      moon2.style.fontSize = "1.4rem";
      moon2.style.textAlign = "center";
      moon2.textContent = "\uD83C\uDF19";
      const txt2 = document.createElement("div");
      txt2.style.color = "var(--text-faint)";
      txt2.style.fontStyle = "italic";
      txt2.style.fontSize = "0.82rem";
      txt2.style.textAlign = "center";
      txt2.textContent = pickCopy(["ghost_diary_1","ghost_diary_2","ghost_diary_3","ghost_diary_4"], uid, dateStr);
      diaryZone.append(moon2, txt2);
    } else {
      const diary = renderDiaryStrip(diaryEntry, privacy, signal, { isFollowing: true });
      if (diary) diaryZone.appendChild(diary);
    }
    card.appendChild(diaryZone);

  } else if (tier === "lowkey") {
    // Cal zone
    const calZone = document.createElement("div");
    calZone.className = "fw-feed-cal-zone";
    calZone.appendChild(buildZoneLblRow("ACTIVITY", "fw-feed-section-lbl", renderTierBadge(privacy.calendar)));
    const block = document.createElement("div");
    block.className = "fw-feed-signal-block";
    const headline = document.createElement("div");
    headline.style.fontStyle = "italic";
    headline.textContent = signal.calendarHeadline;
    const whisper = document.createElement("div");
    whisper.style.color = "var(--text-faint)";
    whisper.style.fontSize = "0.75rem";
    whisper.style.marginTop = "4px";
    whisper.textContent = "low key";
    block.append(headline, whisper);
    calZone.appendChild(block);
    card.appendChild(calZone);

    // Divider + diary zone
    const divider = document.createElement("div");
    divider.className = "fw-feed-zone-divider";
    card.appendChild(divider);

    const diaryZone = document.createElement("div");
    diaryZone.className = "fw-feed-diary-zone";
    diaryZone.appendChild(buildZoneLblRow("diary.", "fw-feed-diary-lbl", renderTierBadge(privacy.diary)));
    const diary = renderDiaryStrip(diaryEntry, privacy, signal, { isFollowing: true });
    if (diary) diaryZone.appendChild(diary);
    card.appendChild(diaryZone);

  } else {
    // sharing or followers

    // Cal zone
    const calZone = document.createElement("div");
    calZone.className = "fw-feed-cal-zone";
    calZone.appendChild(buildZoneLblRow("ACTIVITY", "fw-feed-section-lbl", renderTierBadge(privacy.calendar)));

    if (log?.activities?.length) {
      const chips = document.createElement("div");
      chips.className = "fw-feed-chips";
      log.activities.forEach((act, i) => {
        const chip = document.createElement("span");
        const name = actName(act);
        const hasMarks = (log.marks?.[name] || []).length > 0;
        if (hasMarks) {
          chip.className = "fw-feed-chip";
          chip.style.background = actColor(act, i);
          chip.textContent = "\u2713 " + name;
        } else {
          chip.className = "fw-feed-chip fw-feed-chip-off";
          chip.textContent = name;
        }
        chips.appendChild(chip);
      });
      calZone.appendChild(chips);

      // 7-day activity strip
      const strip = document.createElement("div");
      strip.className = "fw-feed-strip";

      const today = new Date().getDate();
      const startDay = Math.max(1, today - 6);

      for (let d = startDay; d <= today; d++) {
        const col = document.createElement("div");
        col.className = "fw-feed-strip-day";

        const dayNum = document.createElement("div");
        dayNum.className = "fw-feed-strip-daynum";
        dayNum.textContent = d;
        col.appendChild(dayNum);

        log.activities.forEach((act, i) => {
          const dot = document.createElement("div");
          dot.className = "fw-feed-strip-dot";
          const name = actName(act);
          const marked = (log.marks?.[name] || []).includes(d);
          if (marked) {
            dot.style.background = actColor(act, i);
          } else {
            dot.style.border = "1.5px solid var(--border)";
            dot.style.background = "transparent";
          }
          col.appendChild(dot);
        });
        strip.appendChild(col);
      }
      calZone.appendChild(strip);
    }

    card.appendChild(calZone);

    // Divider + diary zone
    const divider = document.createElement("div");
    divider.className = "fw-feed-zone-divider";
    card.appendChild(divider);

    const diaryZone = document.createElement("div");
    diaryZone.className = "fw-feed-diary-zone";
    if (privacy.diary === "ghost") {
      diaryZone.classList.add("fw-feed-zone-ghost");
    }
    diaryZone.appendChild(buildZoneLblRow("diary.", "fw-feed-diary-lbl", renderTierBadge(privacy.diary)));
    const diary = renderDiaryStrip(diaryEntry, privacy, signal, { isFollowing: true });
    if (diary) {
      const innerLbl = diary.querySelector(".fw-diary-strip-label");
      if (innerLbl) innerLbl.remove();
      diaryZone.appendChild(diary);
    }
    card.appendChild(diaryZone);
  }

  // ── Footer ──
  const footer = document.createElement("div");
  footer.className = "fw-feed-card-footer";

  const pinBtn = document.createElement("button");
  pinBtn.className = "fw-feed-pin-btn";
  pinBtn.textContent = "\uD83D\uDCCC Pin";
  if (options.pinHandler) {
    pinBtn.addEventListener("click", options.pinHandler);
  } else {
    pinBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await setDoc(doc(db, "users", currentUser.uid), { pinnedFollowing: arrayUnion(uid) }, { merge: true });
        showToast("Pinned!");
      } catch {
        showToast("Couldn't pin. Try again.", "error");
      }
    });
  }

  footer.appendChild(pinBtn);
  card.appendChild(footer);

  return card;
}
