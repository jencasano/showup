import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast } from "./ui.js";

const TIERS = [
  { id: "sharing",   name: "Sharing",       desc: "Full content visible to followers." },
  { id: "followers", name: "Followers Only", desc: "Visible only if you follow each other." },
  { id: "lowkey",    name: "Low Key",        desc: "Others see signals, not details." },
  { id: "ghost",     name: "Ghost",          desc: "You appear but share nothing." },
  { id: "private",   name: "Private",        desc: "Completely hidden." },
];

export async function getUserPrivacy(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  const privacy = snap.exists() ? (snap.data().privacy || {}) : {};
  return {
    calendar: privacy.calendar || "sharing",
    diary:    privacy.diary    || "sharing",
  };
}

export async function setUserPrivacy(uid, calendarTier, diaryTier) {
  try {
    await setDoc(doc(db, "users", uid), { privacy: { calendar: calendarTier, diary: diaryTier } }, { merge: true });
    showToast("Privacy updated.");
  } catch {
    showToast("Couldn't save. Try again.", "error");
  }
}

export function openPrivacySettingsModal(currentUser) {
  const overlay = document.createElement("div");
  overlay.id = "privacy-settings-modal";
  document.body.appendChild(overlay);

  let selectedCalendar = "sharing";
  let selectedDiary    = "sharing";

  function close() {
    overlay.remove();
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  getUserPrivacy(currentUser.uid).then(({ calendar, diary }) => {
    selectedCalendar = calendar;
    selectedDiary    = diary;

    const panel = document.createElement("div");
    panel.className = "ps-panel";
    panel.addEventListener("click", (e) => e.stopPropagation());

    panel.innerHTML = `
      <div class="ps-header">
        <div>
          <h2 class="ps-heading">Your Privacy</h2>
          <p class="ps-subheading">Control what others can see when they follow you.</p>
        </div>
        <button class="ps-close" title="Close" aria-label="Close">&times;</button>
      </div>
      <div class="ps-section">
        <div class="ps-section-label">Calendar</div>
        <div class="ps-tiers" data-section="calendar"></div>
      </div>
      <hr class="ps-divider" />
      <div class="ps-section">
        <div class="ps-section-label">Diary</div>
        <div class="ps-tiers" data-section="diary"></div>
      </div>
      <button class="ps-save">Save</button>
    `;

    function renderSection(section) {
      const selected = section === "calendar" ? selectedCalendar : selectedDiary;
      const tiersEl  = panel.querySelector(`.ps-tiers[data-section="${section}"]`);
      tiersEl.innerHTML = "";
      TIERS.forEach(({ id, name, desc }) => {
        const row = document.createElement("button");
        row.className = "ps-tier-option" + (id === selected ? " tier-option-active" : "");
        row.dataset.tier = id;
        row.innerHTML = `<span class="ps-tier-name">${name}</span><span class="ps-tier-desc">${desc}</span>`;
        row.addEventListener("click", () => {
          if (section === "calendar") selectedCalendar = id;
          else selectedDiary = id;
          renderSection(section);
        });
        tiersEl.appendChild(row);
      });
    }

    renderSection("calendar");
    renderSection("diary");

    panel.querySelector(".ps-close").addEventListener("click", close);
    panel.querySelector(".ps-save").addEventListener("click", async () => {
      await setUserPrivacy(currentUser.uid, selectedCalendar, selectedDiary);
      close();
    });

    overlay.appendChild(panel);
  });
}
