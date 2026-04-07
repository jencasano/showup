export function renderFeedView(container) {
  container.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "following-empty";

  const icon = document.createElement("div");
  icon.style.fontSize = "2rem";
  icon.textContent = "\uD83D\uDCF0";

  const heading = document.createElement("h3");
  heading.className = "following-empty-title";
  heading.textContent = "Feed coming soon";

  const sub = document.createElement("p");
  sub.className = "following-empty-sub";
  sub.textContent = "The activity feed is on its way.";

  wrap.append(icon, heading, sub);
  container.appendChild(wrap);
}
