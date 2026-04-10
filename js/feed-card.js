import { getPrivacy, renderTierBadge } from "./following-utils.js";
import { computeSignal } from "./following-signals.js";
import { renderDiaryStrip } from "./diary-strip.js";
import { db } from "./firebase-config.js";
import { doc, setDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast } from "./ui.js";

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
    const zone = document.createElement("div");
    zone.className = "fw-feed-signal-block";
    zone.style.textAlign = "center";
    const moon = document.createElement("div");
    moon.style.fontSize = "1.4rem";
    moon.textContent = "\uD83C\uDF19";
    const txt = document.createElement("div");
    txt.style.color = "var(--text-faint)";
    txt.style.fontStyle = "italic";
    txt.style.fontSize = "0.82rem";
    txt.textContent = "Gone quiet for now.";
    zone.append(moon, txt);
    card.appendChild(zone);
  } else if (tier === "lowkey") {
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
    card.appendChild(block);

    const diary = renderDiaryStrip(diaryEntry, privacy, signal, { isFollowing: true });
    if (diary) card.appendChild(diary);
  } else {
    // sharing or followers
    if (log?.activities?.length) {
      const chips = document.createElement("div");
      chips.className = "fw-feed-chips";
      for (const act of log.activities) {
        const chip = document.createElement("span");
        const key = act.key || act.name;
        const hasMarks = log.marks?.[key]?.length > 0;
        if (hasMarks) {
          chip.className = "fw-feed-chip";
          chip.style.background = act.color || "var(--color-primary)";
          chip.style.color = "#fff";
        } else {
          chip.className = "fw-feed-chip fw-feed-chip-off";
        }
        chip.textContent = act.name;
        chips.appendChild(chip);
      }
      card.appendChild(chips);
    }

    const diary = renderDiaryStrip(diaryEntry, privacy, signal, { isFollowing: true });
    if (diary) card.appendChild(diary);

    // 7-day activity strip
    if (log?.activities?.length) {
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

        for (const act of log.activities) {
          const dot = document.createElement("div");
          dot.className = "fw-feed-strip-dot";
          const key = act.key || act.name;
          const marked = log.marks?.[key]?.includes(d);
          if (marked) {
            dot.style.background = act.color || "var(--color-primary)";
          } else {
            dot.style.border = "1.5px solid var(--border)";
            dot.style.background = "transparent";
          }
          col.appendChild(dot);
        }
        strip.appendChild(col);
      }
      card.appendChild(strip);
    }
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
  footer.appendChild(pinBtn);
  card.appendChild(footer);

  return card;
}
