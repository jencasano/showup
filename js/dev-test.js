// ═══════════════════════════════════════════════
// showup. Dev Test Harness
// Console tool for testing feed, privacy, and diary scenarios.
// All writes go through the adminTestHarness Cloud Function
// (admin SDK privileges, dummy users only).
//
// Usage:
//   const t = await import('/js/dev-test.js');
//   await t.listUsers();
//   await t.markToday('dummy_abc_01');
//   await t.writeDiary('dummy_abc_01', { note: 'Test entry' });
//   await t.setPrivacy('dummy_abc_01', { calendar: 'lowkey', diary: 'ghost' });
//   await t.runScenario('privacy-matrix');
// ═══════════════════════════════════════════════

import { app, auth, db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

const functions = getFunctions(app, "asia-southeast1");
const harnessFn = httpsCallable(functions, "adminTestHarness");

async function callHarness(action, uid, payload = {}) {
  const result = await harnessFn({ action, uid, payload });
  return result.data;
}

function currentUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in.");
  return uid;
}

async function getFollowedUsers() {
  const uid = currentUid();
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return [];
  const following = snap.data().following || [];
  const users = [];
  for (const fuid of following) {
    const usnap = await getDoc(doc(db, "users", fuid));
    if (usnap.exists()) {
      const data = usnap.data();
      users.push({
        uid: fuid,
        name: data.displayName || "Unknown",
        privacy: {
          calendar: data.privacy?.calendar || "sharing",
          diary: data.privacy?.diary || "sharing",
        },
      });
    }
  }
  return users;
}

async function getDummyUsers() {
  const all = await getFollowedUsers();
  return all.filter(u => u.uid.startsWith("dummy_"));
}

// ── listUsers ────────────────────────────────────────

export async function listUsers() {
  const users = await getFollowedUsers();
  if (users.length === 0) {
    console.log("You're not following anyone.");
    return [];
  }
  console.table(users.map(u => ({
    uid: u.uid,
    name: u.name,
    calendar: u.privacy.calendar,
    diary: u.privacy.diary,
  })));
  return users;
}

// ── markToday ────────────────────────────────────────

export async function markToday(uid, activityName) {
  const result = await callHarness("markToday", uid, { activityName });
  console.log(`Marked "${result.activity}" for day ${result.day} on ${uid}${result.created ? " (created log)" : ""}`);
  return result;
}

// ── writeDiary ───────────────────────────────────────

export async function writeDiary(uid, { note, photoUrl } = {}) {
  if (!note && !photoUrl) throw new Error("Provide at least one of: note, photoUrl");
  const result = await callHarness("writeDiary", uid, { note, photoUrl });
  console.log(`Wrote diary for ${uid} on ${result.dateStr}`);
  return result;
}

// ── setPrivacy ───────────────────────────────────────

export async function setPrivacy(uid, { calendar, diary } = {}) {
  const result = await callHarness("setPrivacy", uid, { calendar, diary });
  console.log(`Privacy updated for ${uid}:`, result.update);
  return result;
}

// ── runScenario ──────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const SCENARIOS = {
  async realtime(users) {
    const u = users[Math.floor(Math.random() * users.length)];
    if (!u) throw new Error("No followed users.");
    console.log(`--- realtime: simulating ${u.name} ---`);
    console.log(`[1/2] ${u.name} marks calendar...`);
    await markToday(u.uid);
    console.log("Waiting 5s...");
    await sleep(5000);
    console.log(`[2/2] ${u.name} writes diary...`);
    await writeDiary(u.uid, { note: "Just finished a solid session. Feeling good." });
    console.log("--- done ---");
  },

  async "privacy-matrix"(users) {
    const combos = [
      { calendar: "sharing",   diary: "sharing" },
      { calendar: "sharing",   diary: "lowkey" },
      { calendar: "sharing",   diary: "ghost" },
      { calendar: "sharing",   diary: "private" },
      { calendar: "followers", diary: "sharing" },
      { calendar: "followers", diary: "followers" },
      { calendar: "lowkey",    diary: "sharing" },
      { calendar: "lowkey",    diary: "lowkey" },
      { calendar: "ghost",     diary: "sharing" },
      { calendar: "ghost",     diary: "ghost" },
      { calendar: "private",   diary: "private" },
    ];
    console.log(`--- privacy-matrix: applying ${Math.min(users.length, combos.length)} combos ---`);
    for (let i = 0; i < Math.min(users.length, combos.length); i++) {
      const combo = combos[i];
      await setPrivacy(users[i].uid, combo);
      console.log(`  ${users[i].name}: cal=${combo.calendar}, diary=${combo.diary}`);
    }
    console.log("--- done. Check Following + All tabs. ---");
  },

  async burst(users) {
    const targets = users.slice(0, Math.min(5, users.length));
    if (targets.length === 0) throw new Error("No followed users.");
    console.log(`--- burst: ${targets.length} users updating rapidly ---`);
    for (let i = 0; i < targets.length; i++) {
      const u = targets[i];
      await markToday(u.uid);
      await writeDiary(u.uid, { note: `Burst update #${i + 1} from ${u.name}.` });
      console.log(`  [${i + 1}/${targets.length}] ${u.name} done`);
      if (i < targets.length - 1) await sleep(1500);
    }
    console.log("--- done. Check feed sort order. ---");
  },
};

export async function runScenario(name) {
  const fn = SCENARIOS[name];
  if (!fn) {
    console.log("Available scenarios:", Object.keys(SCENARIOS).join(", "));
    throw new Error(`Unknown scenario: "${name}"`);
  }
  const users = await getDummyUsers();
  if (users.length === 0) throw new Error("No dummy users followed. Follow some dummy_* users first.");
  await fn(users);
}
