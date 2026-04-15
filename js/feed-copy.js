// feed-copy.js -- Resolves feed event copy from the new key format
// Keys: feed_{tier}_{eventType}_{context}_{variant}

import { pickCopy, copyReady, signalCopy } from "./following-signals.js";

// Lookup map built once after copy JSON loads:
// "sharing_log_default" -> ["feed_sharing_log_default_1", "feed_sharing_log_default_2", ...]
let variantMap = new Map();

const mapReady = copyReady.then(() => {
  for (const key of Object.keys(signalCopy)) {
    if (!key.startsWith("feed_")) continue;
    // Strip trailing _N variant number to get the group key
    const lastUnderscore = key.lastIndexOf("_");
    const suffix = key.slice(lastUnderscore + 1);
    if (!/^\d+$/.test(suffix)) continue;
    const group = key.slice(5, lastUnderscore); // drop "feed_" prefix
    if (!variantMap.has(group)) variantMap.set(group, []);
    variantMap.get(group).push(key);
  }
});

export function resolveFeedCopy(tier, eventType, context, uid, dateStr) {
  // Normalize: "low key" -> "lowkey", spaces/hyphens stripped
  const t = tier.replace(/[\s-]/g, "").toLowerCase();
  const group = `${t}_${eventType}_${context}`;
  let variants = variantMap.get(group);

  // Fallback to default context if no variants for this context
  if (!variants || variants.length === 0) {
    const fallbackGroup = `${t}_${eventType}_default`;
    variants = variantMap.get(fallbackGroup);
  }

  if (!variants || variants.length === 0) return "";

  return pickCopy(variants, uid, dateStr);
}

export function fillFeedCopy(template, { firstName, activities, date }) {
  if (!template) return "";
  let out = template;
  if (firstName)  out = out.replace(/\{firstName\}/g, firstName);
  if (activities) out = out.replace(/\{activities\}/g, activities);
  if (date)       out = out.replace(/\{date\}/g, date);
  return out;
}

export { mapReady };
