import { showToast } from "./ui.js";

function formatDocId(docId) {
  const [year, month, day] = docId.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleString("en-US", {
    month: "short", day: "numeric"
  });
}

// ── Diary Strip (synchronous -- entry already fetched and cached) ──

export function renderDiaryStrip(entry, privacy, signal, { isFollowing = true } = {}) {
  if (privacy.diary === "ghost" || privacy.diary === "private") return null;

  if (privacy.diary === "followers" && !isFollowing) {
    const strip = document.createElement("div");
    strip.className = "fw-diary-strip";
    const lbl = document.createElement("span");
    lbl.className = "fw-diary-strip-label";
    lbl.textContent = "diary.";
    const locked = document.createElement("span");
    locked.className = "fw-diary-strip-signal";
    locked.textContent = "Follow to see their diary.";
    strip.append(lbl, locked);
    return strip;
  }

  if (privacy.diary === "lowkey") {
    const strip = document.createElement("div");
    strip.className = "fw-diary-strip";
    const lbl = document.createElement("span");
    lbl.className = "fw-diary-strip-label";
    lbl.textContent = "diary.";
    const sig = document.createElement("span");
    sig.className = "fw-diary-strip-signal";
    sig.textContent = signal.diaryHeadline;
    strip.append(lbl, sig);
    return strip;
  }

  // sharing or followers -- entry is already resolved, no async needed
  if (!entry?.note) return null;

  const strip = document.createElement("div");
  strip.className = "fw-diary-strip";

  const header = document.createElement("div");
  header.className = "fw-diary-strip-header";
  const lbl = document.createElement("span");
  lbl.className = "fw-diary-strip-label";
  lbl.textContent = "diary.";
  const date = document.createElement("span");
  date.className = "fw-diary-strip-date";
  date.textContent = formatDocId(entry.docId);
  header.append(lbl, date);

  const body = document.createElement("div");
  body.className = "fw-diary-strip-body";
  const note = document.createElement("div");
  note.className = "fw-diary-strip-note";
  note.textContent = entry.note;
  body.appendChild(note);

  if (entry.photoUrl) {
    const photo = document.createElement("img");
    photo.className = "fw-diary-strip-photo";
    photo.src = entry.photoUrl;
    photo.alt = "";
    body.appendChild(photo);
  }

  const footer = document.createElement("div");
  footer.className = "fw-diary-strip-footer";
  const viewBtn = document.createElement("button");
  viewBtn.className = "fw-diary-view-btn";
  viewBtn.textContent = "view full diary \u2192";
  viewBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showToast("Coming soon!");
  });
  footer.appendChild(viewBtn);
  strip.append(header, body, footer);
  return strip;
}
