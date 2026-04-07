import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast } from "./ui.js";

const TIERS = [
  { id: "sharing",   name: "Sharing",        desc: "Your tracker and diary are visible to your followers." },
  { id: "followers", name: "Followers Only",  desc: "Your tracker is visible, diary is private." },
  { id: "lowkey",    name: "Low Key",         desc: "Followers see your check-in count but not which activities." },
  { id: "ghost",     name: "Ghost",           desc: "You appear in the list but share nothing." },
  { id: "private",   name: "Private",         desc: "Completely hidden from all social views." },
];

export async function getUserPrivacyTier(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data().privacyTier || "sharing") : "sharing";
}

export async function setUserPrivacyTier(uid, tier) {
  try {
    await setDoc(doc(db, "users", uid), { privacyTier: tier }, { merge: true });
    showToast("Privacy updated.");
  } catch {
    showToast("Couldn't save. Try again.", "error");
  }
}

export function openPrivacySettingsModal(currentUser) {
  const overlay = document.createElement("div");
  overlay.id = "privacy-settings-modal";
  document.body.appendChild(overlay);

  let selectedTier = "sharing";

  function close() {
    overlay.remove();
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  getUserPrivacyTier(currentUser.uid).then((currentTier) => {
    selectedTier = currentTier;

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
      <div class="ps-tiers"></div>
      <button class="ps-save">Save</button>
    `;

    const tiersEl = panel.querySelector(".ps-tiers");

    function renderTiers() {
      tiersEl.innerHTML = "";
      TIERS.forEach(({ id, name, desc }) => {
        const row = document.createElement("button");
        row.className = "ps-tier-option" + (id === selectedTier ? " tier-option-active" : "");
        row.dataset.tier = id;
        row.innerHTML = `<span class="ps-tier-name">${name}</span><span class="ps-tier-desc">${desc}</span>`;
        row.addEventListener("click", () => {
          selectedTier = id;
          renderTiers();
        });
        tiersEl.appendChild(row);
      });
    }

    renderTiers();

    panel.querySelector(".ps-close").addEventListener("click", close);
    panel.querySelector(".ps-save").addEventListener("click", async () => {
      await setUserPrivacyTier(currentUser.uid, selectedTier);
      close();
    });

    overlay.appendChild(panel);
  });
}
