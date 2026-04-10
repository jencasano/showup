// ── Shared privacy + tier helpers for Following views ──

export const TIER_META = {
  sharing:   { label: "Sharing",   cls: "fw-tier-sharing"   },
  followers: { label: "Followers", cls: "fw-tier-followers" },
  lowkey:    { label: "Low Key",   cls: "fw-tier-lowkey"    },
  ghost:     { label: "Ghost",     cls: "fw-tier-ghost"     },
  private:   { label: "Private",   cls: "fw-tier-private"   },
};

export function getPrivacy(userDoc) {
  const p = userDoc?.privacy || {};
  return {
    calendar: p.calendar || "sharing",
    diary:    p.diary    || "sharing",
  };
}

export function renderTierBadge(tier) {
  const meta = TIER_META[tier] || TIER_META.sharing;
  const span = document.createElement("span");
  span.className = `fw-tier-badge ${meta.cls}`;
  span.textContent = meta.label;
  return span;
}
