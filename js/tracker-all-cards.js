import { db } from "./firebase-config.js";
import {
  doc, setDoc, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast } from "./ui.js";
import { computeSignal } from "./following-signals.js";

export function renderLockedCard(entry, isFollowing, currentUser) {
  const { color, fontColor, font, avatarUrl } = entry.decoration;
  let following = isFollowing;
  let followLoading = false;

  const card = document.createElement("div");
  card.className = "all-locked-card";
  card.style.borderColor = color;

  // ── Badge ──────────────────────────────────────────
  const badge = document.createElement("div");
  badge.className = "all-locked-badge";
  badge.style.background = color;
  badge.style.color = fontColor;
  badge.style.fontFamily = `'${font}', sans-serif`;

  const avatarEl = document.createElement("div");
  avatarEl.className = "cal-card-avatar-wrap";
  if (avatarUrl) {
    avatarEl.innerHTML = `<img src="${avatarUrl}" class="cal-card-avatar" alt="avatar" />`;
  } else {
    const initials = (entry.displayName || "?").charAt(0).toUpperCase();
    avatarEl.innerHTML = `<div class="cal-card-avatar-initials">${initials}</div>`;
  }

  const nameSpan = document.createElement("span");
  nameSpan.className = "cal-card-name";
  nameSpan.title = entry.displayName;
  nameSpan.textContent = entry.displayName;

  const lockIcon = document.createElement("span");
  lockIcon.className = "all-locked-icon";
  lockIcon.textContent = "\u{1F512}";

  badge.append(avatarEl, nameSpan, lockIcon);

  // ── Follow / Unfollow button ───────────────────────
  if (currentUser) {
    const followBtn = document.createElement("button");
    followBtn.className = `cal-follow-btn ${following ? "following" : ""}`;
    followBtn.innerHTML = following
      ? `<span class="follow-btn-check">\u2713</span> Following`
      : `<span class="follow-btn-plus">+</span> Follow`;

    followBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (followLoading) return;
      followLoading = true;
      followBtn.disabled = true;
      followBtn.classList.add("loading");
      try {
        const myRef = doc(db, "users", currentUser.uid);
        if (following) {
          await setDoc(myRef, {
            following: arrayRemove(entry.id),
            pinnedFollowing: arrayRemove(entry.id)
          }, { merge: true });
          following = false;
          followBtn.innerHTML = `<span class="follow-btn-plus">+</span> Follow`;
          followBtn.classList.remove("following");
        } else {
          await setDoc(myRef, { following: arrayUnion(entry.id) }, { merge: true });
          following = true;
          followBtn.innerHTML = `<span class="follow-btn-check">\u2713</span> Following`;
          followBtn.classList.add("following");
        }
      } catch (err) {
        console.error("Follow error:", err);
        showToast("Couldn't update follow. Try again.", "error");
      } finally {
        followLoading = false;
        followBtn.disabled = false;
        followBtn.classList.remove("loading");
      }
    });
    badge.appendChild(followBtn);
  }

  card.appendChild(badge);

  // ── Locked body ────────────────────────────────────
  const body = document.createElement("div");
  body.className = "all-locked-body";
  body.innerHTML = `
    <div class="all-locked-symbol">\u{1F512}</div>
    <div class="all-locked-copy">Follow to see their tracker.</div>
  `;
  card.appendChild(body);

  card.addEventListener("click", () => {});

  return card;
}

// ─── LOW KEY CARD ──────────────────────────────────
export function renderLowKeyCard(entry, yearMonth, isFollowing, currentUser) {
  const { color, fontColor, font, avatarUrl } = entry.decoration;
  let following = isFollowing;
  let followLoading = false;

  const card = document.createElement("div");
  card.className = "all-lowkey-card";
  card.style.borderColor = color;

  // ── Badge ──────────────────────────────────────────
  const badge = document.createElement("div");
  badge.className = "all-locked-badge";
  badge.style.background = color;
  badge.style.color = fontColor;
  badge.style.fontFamily = `'${font}', sans-serif`;

  const avatarEl = document.createElement("div");
  avatarEl.className = "cal-card-avatar-wrap";
  if (avatarUrl) {
    avatarEl.innerHTML = `<img src="${avatarUrl}" class="cal-card-avatar" alt="avatar" />`;
  } else {
    const initials = (entry.displayName || "?").charAt(0).toUpperCase();
    avatarEl.innerHTML = `<div class="cal-card-avatar-initials">${initials}</div>`;
  }

  const nameSpan = document.createElement("span");
  nameSpan.className = "cal-card-name";
  nameSpan.title = entry.displayName;
  nameSpan.textContent = entry.displayName;

  const [y, m] = yearMonth.split("-").map(Number);
  const nav = document.createElement("div");
  nav.className = "cal-pmn";
  const monthLbl = document.createElement("span");
  monthLbl.className = "cal-pmn-lbl";
  monthLbl.textContent = new Date(y, m - 1).toLocaleString("en", { month: "short" });
  nav.appendChild(monthLbl);

  badge.append(avatarEl, nameSpan, nav);

  // ── Follow / Unfollow button ───────────────────────
  if (currentUser) {
    const followBtn = document.createElement("button");
    followBtn.className = `cal-follow-btn ${following ? "following" : ""}`;
    followBtn.style.marginLeft = "auto";
    followBtn.innerHTML = following
      ? `<span class="follow-btn-check">\u2713</span> Following`
      : `<span class="follow-btn-plus">+</span> Follow`;

    followBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (followLoading) return;
      followLoading = true;
      followBtn.disabled = true;
      followBtn.classList.add("loading");
      try {
        const myRef = doc(db, "users", currentUser.uid);
        if (following) {
          await setDoc(myRef, {
            following: arrayRemove(entry.id),
            pinnedFollowing: arrayRemove(entry.id)
          }, { merge: true });
          following = false;
          followBtn.innerHTML = `<span class="follow-btn-plus">+</span> Follow`;
          followBtn.classList.remove("following");
        } else {
          await setDoc(myRef, { following: arrayUnion(entry.id) }, { merge: true });
          following = true;
          followBtn.innerHTML = `<span class="follow-btn-check">\u2713</span> Following`;
          followBtn.classList.add("following");
        }
      } catch (err) {
        console.error("Follow error:", err);
        showToast("Couldn't update follow. Try again.", "error");
      } finally {
        followLoading = false;
        followBtn.disabled = false;
        followBtn.classList.remove("loading");
      }
    });
    badge.appendChild(followBtn);
  }

  card.appendChild(badge);

  // ── Signal body ────────────────────────────────────
  const signal = computeSignal(entry.displayName, entry);
  const body = document.createElement("div");
  body.className = "all-lowkey-body";

  const headlineEl = document.createElement("div");
  headlineEl.className = "all-lowkey-headline";
  headlineEl.textContent = signal.calendarHeadline;

  const whisperEl = document.createElement("div");
  whisperEl.className = "all-lowkey-whisper";
  whisperEl.textContent = "low key";

  body.append(headlineEl, whisperEl);
  card.appendChild(body);

  card.addEventListener("click", () => {});

  return card;
}
