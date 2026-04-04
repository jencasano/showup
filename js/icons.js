// ═══════════════════════════════════════════════
// showup. Custom Icon System
// Drop-in replacement for system emojis.
// All icons are SVGs in /assets/icons/
// ═══════════════════════════════════════════════

const ICONS_PATH = '/assets/icons';

// All available icon names
export const ICON_NAMES = [
  'flame',       // 🔥  streak stat, badges
  'sunflower',   // 🌻  sticker
  'muscle',      // 💪  sticker
  'star',        // ⭐  sticker
  'target',      // 🎯  sticker
  'run',         // 🏃  sticker
  'brain',       // 🧠  sticker
  'bacon',       // 🥓  sticker
  'steak',       // 🥩  sticker
  'butter',      // 🧈  sticker
  'sparkle',     // ✨  sticker / celebration states
  'sprout',      // 🌱  sticker
  'dumbbell',    // ❚█══█❚  sticker
  'headphones',  // 🎧  sticker
  'siren',       // 🚨  sticker
  'boom',        // 💥  sticker
  'megaphone',   // 📢  sticker
  'calendar',    // 📅  month picker button
  'sun',         // ☀️   light mode toggle
  'moon',        // 🌙  dark mode toggle
  'my-log',      // 👤✨ My Log nav (mobile bottom nav)
  'following',   // ❤️   Following nav
  'all',         // ⊞   All nav
  'now',         // 🟨  NOW badge/sticker
];

// Sticker options shown in month setup
export const STICKER_ICONS = [
  'sunflower', 'muscle', 'star', 'target', 'run',
  'brain', 'bacon', 'steak', 'butter', 'sparkle',
  'sprout', 'dumbbell', 'headphones', 'siren', 'boom', 'megaphone'
];

// ── Returns an <img> DOM element ─────────────────
// Usage: container.appendChild(iconEl('flame', 20))
export function iconEl(name, size = 24, className = '') {
  const img = document.createElement('img');
  img.src = `${ICONS_PATH}/${name}.svg`;
  img.width = size;
  img.height = size;
  img.alt = name;
  img.draggable = false;
  img.className = ['showup-icon', className].filter(Boolean).join(' ');
  return img;
}

// ── Returns an HTML string ────────────────────────
// Usage: el.innerHTML = `${icon('flame', 16)} 3 day streak`
export function icon(name, size = 24, className = '') {
  return `<img src="${ICONS_PATH}/${name}.svg" width="${size}" height="${size}" alt="${name}" draggable="false" class="showup-icon${className ? ' ' + className : ''}" />`;
}

// ── Returns icon src path only ────────────────────
// Usage: img.src = iconSrc('flame')
export function iconSrc(name) {
  return `${ICONS_PATH}/${name}.svg`;
}

// ── Replace emoji text with icon in an HTML string ─
// Usage: replaceEmoji('🔥 1 day streak', '🔥', 'flame', 16)
export function replaceEmoji(html, emoji, iconName, size = 16) {
  return html.replaceAll(emoji, icon(iconName, size));
}
