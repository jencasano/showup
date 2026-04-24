// ─── TOAST ───────────────────────────────────────────
export function showToast(message, type = "neutral") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("toast-visible"), 10);
  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── LOADER ──────────────────────────────────────────
export function showLoader() {
  const loader = document.createElement("div");
  loader.id = "global-loader";
  loader.innerHTML = `<div class="spinner"></div>`;
  document.body.appendChild(loader);
}

export function hideLoader() {
  const loader = document.getElementById("global-loader");
  if (loader) loader.remove();
}