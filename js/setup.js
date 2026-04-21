import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showMonthSetup } from "./month-setup.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "index.html"; return; }
  currentUser = user;
  document.getElementById("display-name-input").value = user.displayName || "";
  document.getElementById("progress-fill").style.width = "100%";
  document.getElementById("step-label").textContent = "Step 1 of 1";
});

document.getElementById("next-btn").addEventListener("click", async () => {
  const name = document.getElementById("display-name-input").value.trim();
  if (!name) { alert("Please enter a display name!"); return; }

  const btn = document.getElementById("next-btn");
  const setupContainer = document.getElementById("setup-container");
  btn.textContent = "Saving...";
  btn.disabled = true;

  try {
    // Save minimal profile
    await setDoc(doc(db, "users", currentUser.uid), {
      displayName: name,
      email: currentUser.email,
      setupComplete: true,
      createdAt: serverTimestamp()
    });

    // Hide base setup card while month-setup modal is active so it
    // doesn't flash briefly when the modal closes before redirect.
    setupContainer.style.visibility = "hidden";

    // Now trigger monthly setup (decoration + activities)
    await showMonthSetup(currentUser.uid, currentUser.photoURL, null, name);

    window.location.href = "index.html";
  } catch (error) {
    console.error("Error saving profile:", error);
    alert("Something went wrong. Please try again.");
    setupContainer.style.visibility = "";
    btn.textContent = "Next, →";
    btn.disabled = false;
  }
});
