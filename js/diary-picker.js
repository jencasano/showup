import { DIARY_COVERS } from "./diary-covers.js";

export function renderMiniCover(coverKey, { width = 70, height = 90 } = {}) {
  const cover = DIARY_COVERS[coverKey];
  if (!cover) return null;

  const el = document.createElement("div");
  el.className = "diary-mini-cover";
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.style.background = cover.coverGradient;

  const title = document.createElement("span");
  title.className = "diary-mini-cover-title";
  title.textContent = "diary.";
  title.style.color = cover.titleColor;
  title.style.textShadow = cover.titleTextShadow || "none";
  title.style.fontSize = `${width * 0.22}px`;
  el.appendChild(title);

  return el;
}

export function renderCoverPopover(currentCover, onSelect, {
  ownedCovers = null,
  defaultCover = null,
  monthName = null
} = {}) {
  const popover = document.createElement("div");
  popover.className = "diary-cover-popover";

  const showOverrideCaption = defaultCover && monthName && currentCover !== defaultCover;

  for (const key of Object.keys(DIARY_COVERS)) {
    const cover = DIARY_COVERS[key];
    const isOwned = ownedCovers ? ownedCovers.includes(key) : true;
    const isLocked = cover.isPaid && !isOwned;

    const slot = document.createElement("button");
    slot.className = "diary-cover-slot";
    slot.type = "button";
    if (key === currentCover) slot.classList.add("diary-cover-slot--selected");
    if (isLocked) slot.classList.add("diary-cover-slot--locked");

    const mini = renderMiniCover(key);
    slot.appendChild(mini);

    if (isLocked) {
      const lockBadge = document.createElement("span");
      lockBadge.className = "diary-cover-lock";
      lockBadge.textContent = "\u{1F512}";
      slot.appendChild(lockBadge);
    }

    const name = document.createElement("span");
    name.className = "diary-cover-slot-name";
    name.textContent = cover.displayName;
    slot.appendChild(name);

    if (key === currentCover && showOverrideCaption) {
      const caption = document.createElement("span");
      caption.className = "diary-cover-slot-override";
      caption.textContent = `just for ${monthName}`;
      slot.appendChild(caption);
    }

    slot.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isLocked) return;
      onSelect(key);
    });

    popover.appendChild(slot);
  }

  return popover;
}

export function renderCoverRow(currentCover, onSelect, {
  ownedCovers = null,
  defaultCover = null,
  monthName = null
} = {}) {
  const row = renderCoverPopover(currentCover, onSelect, { ownedCovers, defaultCover, monthName });
  row.classList.remove("diary-cover-popover");
  row.classList.add("diary-cover-row");
  return row;
}
