import { app, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

const authBlock = document.getElementById("auth-block");
const seedForm = document.getElementById("seed-form");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const endMonthInput = document.getElementById("end-month");

const currentYm = new Date().toISOString().slice(0, 7);
endMonthInput.value = currentYm;

const functions = getFunctions(app, "asia-southeast1");
const generateFn = httpsCallable(functions, "adminGenerateDummyUsers");
const deleteFn = httpsCallable(functions, "adminDeleteDummyBatch");

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`.trim();
}

function setBusy(isBusy) {
  seedForm.querySelectorAll("button, input").forEach(el => {
    el.disabled = isBusy;
  });
}

function showResult(obj) {
  resultEl.textContent = JSON.stringify(obj, null, 2);
}

function monthToYm(v) {
  if (!v) return "";
  return v.slice(0, 7);
}

async function doGenerate(e) {
  e.preventDefault();
  const userCount = Number(document.getElementById("user-count").value || 15);
  const seed = Number(document.getElementById("seed-value").value || 2026);
  const startMonth = monthToYm(document.getElementById("start-month").value);
  const endMonth = monthToYm(document.getElementById("end-month").value);
  const includeCurrentMonthToToday = document.getElementById("upto-today").checked;
  const overwrite = document.getElementById("overwrite").checked;

  if (!startMonth || !endMonth) {
    setStatus("Start and end month are required.", "err");
    return;
  }

  if (!window.confirm(`Generate ${userCount} dummy users from ${startMonth} to ${endMonth}?`)) {
    return;
  }

  try {
    setBusy(true);
    setStatus("Generating dummy data...", "");
    const res = await generateFn({
      userCount,
      startMonth,
      endMonth,
      includeCurrentMonthToToday,
      overwrite,
      seed
    });

    showResult(res.data);
    const batchId = res.data.seedBatchId || "";
    document.getElementById("batch-id").value = batchId;
    localStorage.setItem("lastDummySeedBatchId", batchId);
    setStatus(`Done. Batch ID: ${batchId}`, "ok");
  } catch (err) {
    console.error(err);
    showResult({ error: err.message, details: err });
    setStatus(`Generate failed: ${err.message}`, "err");
  } finally {
    setBusy(false);
  }
}

async function doDeleteById() {
  const batchId = document.getElementById("batch-id").value.trim();
  if (!batchId) {
    setStatus("Enter a batch ID first.", "err");
    return;
  }

  if (!window.confirm(`Delete all dummy docs in batch ${batchId}? This cannot be undone.`)) {
    return;
  }

  try {
    setBusy(true);
    setStatus("Deleting batch...", "");
    const res = await deleteFn({ seedBatchId: batchId });
    showResult(res.data);
    setStatus(`Deleted batch ${batchId}.`, "ok");
  } catch (err) {
    console.error(err);
    showResult({ error: err.message, details: err });
    setStatus(`Delete failed: ${err.message}`, "err");
  } finally {
    setBusy(false);
  }
}

async function doDeleteLast() {
  const localLast = localStorage.getItem("lastDummySeedBatchId") || "";
  if (!localLast) {
    setStatus("No last batch found in this browser yet.", "err");
    return;
  }

  document.getElementById("batch-id").value = localLast;
  await doDeleteById();
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    authBlock.textContent = "You must sign in first, then reload this page.";
    seedForm.style.display = "none";
    return;
  }

  authBlock.textContent = `Signed in as ${user.displayName || user.email || user.uid}`;
  seedForm.style.display = "block";
  document.getElementById("seed-form").addEventListener("submit", doGenerate);
  document.getElementById("delete-batch-btn").addEventListener("click", doDeleteById);
  document.getElementById("delete-last-btn").addEventListener("click", doDeleteLast);
});
