import { getPrivacy, renderTierBadge } from "./following-utils.js";
import { computeSignal } from "./following-signals.js";
import { renderDiaryStrip } from "./diary-strip.js";
import { db } from "./firebase-config.js";
import { doc, setDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast } from "./ui.js";
import { getActivityColor } from "./utils.js";

function formatYearMonth(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function renderFeedCard(uid, user, log, diaryEntry, yearMonth, currentUser) {
  const displayName = user?.displayName || "Unknown";
  const privacy = getPrivacy(user);
  const signal = computeSignal(displayName, log);
  const deco = log?.decoration || user?.decoration || { color: "#D8584E", fontColor: "#FFFFFF" };
  const initial = displayName.charAt(0).toUpperCase();

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

  const badge = renderTierBadge(privacy.calendar);
  badge.style.position = "absolute";
  badge.style.top = "14px";
  badge.style.right = "16px";

  head.append(avatar, nameCol, badge);
  card.appendChild(head);

  // ── Body ──
  const tier = privacy.calendar;

  if (tier === "ghost") {
    card.style.opacity = "0.55";

    // Cal zone -- ghost
    const calZone = document.createElement("div");
    calZone.className = "fw-feed-cal-zone";
    calZone.style.textAlign = "center";
    const moon1 = document.createElement("div");
    moon1.style.fontSize = "1.4rem";
    moon1.textContent = "\uD83C\uDF19";
    const txt1 = document.createElement("div");
    txt1.style.color = "var(--text-faint)";
    txt1.style.fontStyle = "italic";
    txt1.style.fontSize = "0.82rem";
    txt1.textContent = "Gone quiet for now.";
    calZone.append(moon1, txt1);
    card.appendChild(calZone);

    // Divider
    const div1 = document.createElement("div");
    div1.className = "fw-feed-zone-divider";
    card.appendChild(div1);

    // Diary zone -- ghost (based on privacy.diary)
    const diaryZone = document.createElement("div");
    diaryZone.className = "fw-feed-diary-zone";
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
      txt2.textContent = "Gone quiet for now.";
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
    const diary = renderDiaryStrip(diaryEntry, privacy, signal, { isFollowing: true });
    if (diary) diaryZone.appendChild(diary);
    card.appendChild(diaryZone);

  } else {
    // sharing or followers

    // Cal zone
    const calZone = document.createElement("div");
    calZone.className = "fw-feed-cal-zone";

    const actLabel = document.createElement("div");
    actLabel.className = "fw-feed-section-lbl";
    actLabel.textContent = "ACTIVITY";
    calZone.appendChild(actLabel);

    if (log?.activities?.length) {
      const chips = document.createElement("div");
      chips.className = "fw-feed-chips";
      log.activities.forEach((act, i) => {
        const chip = document.createElement("span");
        const hasMarks = (log.marks?.[act] || []).length > 0;
        if (hasMarks) {
          chip.className = "fw-feed-chip";
          chip.style.background = getActivityColor(i);
          chip.textContent = "\u2713 " + act;
        } else {
          chip.className = "fw-feed-chip fw-feed-chip-off";
          chip.textContent = act;
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
          const marked = (log.marks?.[act] || []).includes(d);
          if (marked) {
            dot.style.background = getActivityColor(i);
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
    const diary = renderDiaryStrip(diaryEntry, privacy, signal, { isFollowing: true });
    if (diary) diaryZone.appendChild(diary);
    card.appendChild(diaryZone);
  }

  // ── Footer ──
  const footer = document.createElement("div");
  footer.className = "fw-feed-card-footer";

  const pinBtn = document.createElement("button");
  pinBtn.className = "fw-feed-pin-btn";
  pinBtn.textContent = "\uD83D\uDCCC Pin";
  pinBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await setDoc(doc(db, "users", currentUser.uid), { pinnedFollowing: arrayUnion(uid) }, { merge: true });
      showToast("Pinned!");
    } catch {
      showToast("Couldn't pin. Try again.", "error");
    }
  });

  const sep = document.createElement("span");
  sep.className = "fw-feed-footer-sep";
  sep.textContent = "|";

  const viewBtn = document.createElement("button");
  viewBtn.className = "fw-feed-view-btn";
  viewBtn.textContent = "\uD83D\uDCC5 View calendar";
  viewBtn.addEventListener("click", () => showToast("Coming soon!"));

  footer.append(pinBtn, sep, viewBtn);
  card.appendChild(footer);

  return card;
}
