import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";

initializeApp();

const db = getFirestore();

const ADMIN_UID = defineString("ADMIN_UID");
const ADMIN_TOOL_EXPIRES_AT = defineString("ADMIN_TOOL_EXPIRES_AT", {
  default: "2026-12-31T23:59:59.000Z"
});

function requireAdminAuth(request) {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  if (uid !== ADMIN_UID.value()) {
    throw new HttpsError("permission-denied", "This admin tool is not enabled for this account.");
  }

  const expiresAtIso = ADMIN_TOOL_EXPIRES_AT.value();
  const expiresAtMs = Date.parse(expiresAtIso);
  if (Number.isNaN(expiresAtMs)) {
    throw new HttpsError("failed-precondition", "ADMIN_TOOL_EXPIRES_AT is not a valid ISO timestamp.");
  }

  if (Date.now() > expiresAtMs) {
    throw new HttpsError("permission-denied", `Admin seeding window ended on ${new Date(expiresAtMs).toISOString()}.`);
  }

  return uid;
}

function toYearMonth(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseYearMonth(input, fieldName) {
  if (typeof input !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(input)) {
    throw new HttpsError("invalid-argument", `${fieldName} must be in YYYY-MM format.`);
  }
  const [year, month] = input.split("-").map(Number);
  return { year, month };
}

function monthList(startYm, endYm) {
  const start = parseYearMonth(startYm, "startMonth");
  const end = parseYearMonth(endYm, "endMonth");

  const startTotal = start.year * 12 + (start.month - 1);
  const endTotal = end.year * 12 + (end.month - 1);

  if (endTotal < startTotal) {
    throw new HttpsError("invalid-argument", "endMonth must be the same as or after startMonth.");
  }

  const out = [];
  for (let total = startTotal; total <= endTotal; total++) {
    const year = Math.floor(total / 12);
    const month = (total % 12) + 1;
    out.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return out;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function daysInMonth(year, month1Indexed) {
  return new Date(Date.UTC(year, month1Indexed, 0)).getUTCDate();
}

function buildMarks({ year, month, activities, chanceByActivity, seed, dayLimit }) {
  const rng = mulberry32(seed);
  const marks = {};

  for (const activity of activities) {
    const chance = Math.max(0.05, Math.min(0.95, chanceByActivity[activity] ?? 0.55));
    const arr = [];
    for (let day = 1; day <= dayLimit; day++) {
      if (rng() < chance) arr.push(day);
    }
    marks[activity] = arr;
  }

  return marks;
}

const PRIVACY_TIERS = ["sharing", "followers", "lowkey", "ghost", "private"];

const DUMMY_DIARY_NOTES = [
  "Kept it simple today. Just showed up and did the work.",
  "Had a rough start but pushed through. Small wins count.",
  "Feeling the momentum building. Consistency is everything.",
  "Rest day, but still moving. Walked around the block twice.",
  "Something clicked today. The routine finally feels natural.",
  "Missed my window this morning. Made up for it tonight.",
  "Three weeks in and I can feel the difference already.",
  "Not my best day, but I didn't skip. That's the point.",
  "Tried a new approach. Jury's still out but felt good.",
  "Energy was low. Did the minimum and called it a win.",
];

const DUMMY_DIARY_PHOTOS = [
  "https://picsum.photos/seed/diary01/600/400",
  "https://picsum.photos/seed/diary02/600/400",
  "https://picsum.photos/seed/diary03/600/400",
  "https://picsum.photos/seed/diary04/600/400",
  "https://picsum.photos/seed/diary05/600/400",
  "https://picsum.photos/seed/diary06/600/400",
  "https://picsum.photos/seed/diary07/600/400",
  "https://picsum.photos/seed/diary08/600/400",
];

const PROFILES = [
  { activities: ["Workout", "Walk", "Mobility"], cadences: [4, 7, 3], chances: { Workout: 0.62, Walk: 0.83, Mobility: 0.48 }, color: "#80B9B9", sticker: "💪", marker: "check" },
  { activities: ["Run", "Stretch", "Hydration"], cadences: [4, 5, 7], chances: { Run: 0.57, Stretch: 0.52, Hydration: 0.79 }, color: "#F8C08A", sticker: "🏃", marker: "star" },
  { activities: ["Yoga", "Read", "Sleep 8h"], cadences: [3, 6, 7], chances: { Yoga: 0.44, Read: 0.67, "Sleep 8h": 0.7 }, color: "#A29BFE", sticker: "🧘", marker: "circle" },
  { activities: ["Meditate", "No Sugar", "Walk"], cadences: [7, 6, 7], chances: { Meditate: 0.61, "No Sugar": 0.51, Walk: 0.75 }, color: "#9AD0EC", sticker: "🧠", marker: "check" }
];

function pickProfile(idx) {
  return PROFILES[idx % PROFILES.length];
}

const REALISTIC_NAMES = [
  "Maria Santos",
  "Joshua Dela Cruz",
  "Angela Reyes",
  "Paolo Villanueva",
  "Katrina Bautista",
  "Miguel Fernandez",
  "Camille Navarro",
  "Carlo Mendoza",
  "Patricia Garcia",
  "Renz Manalo",
  "Jasmine Aquino",
  "Nathaniel Ramos",
  "Bea Mercado",
  "Andre Castillo",
  "Trisha Lim",
  "Kian Domingo",
  "Alyssa Flores",
  "Jericho Valdez",
  "Danica Soriano",
  "Vince Tolentino"
];

function toUsername(fullName, suffixNumber) {
  const base = String(fullName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${base}_${String(suffixNumber).padStart(2, "0")}`;
}

function buildDummyUser(batchId, index) {
  const number = String(index + 1).padStart(2, "0");
  const uid = `dummy_${batchId}_${number}`;
  const displayName = REALISTIC_NAMES[index % REALISTIC_NAMES.length];
  return { uid, displayName, username: toUsername(displayName, index + 1) };
}

export const adminGenerateDummyUsers = onCall({ region: "asia-southeast1", timeoutSeconds: 120, invoker: "public" }, async (request) => {
  const adminUid = requireAdminAuth(request);
  const payload = request.data || {};

  const userCount = Number(payload.userCount ?? 25);
  const startMonth = payload.startMonth ?? "2026-01";
  const endMonth = payload.endMonth ?? toYearMonth(new Date());
  const overwrite = Boolean(payload.overwrite ?? false);
  const includeCurrentMonthToToday = payload.includeCurrentMonthToToday !== false;
  const seed = Number(payload.seed ?? 2026);

  if (!Number.isInteger(userCount) || userCount < 1 || userCount > 100) {
    throw new HttpsError("invalid-argument", "userCount must be an integer between 1 and 100.");
  }

  if (!Number.isFinite(seed)) {
    throw new HttpsError("invalid-argument", "seed must be numeric.");
  }

  const months = monthList(startMonth, endMonth);
  const now = new Date();
  const currentYm = toYearMonth(now);
  const todayUtcDay = now.getUTCDate();
  const batchId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  const createdUserIds = [];
  let usersUpserted = 0;
  let logsWritten = 0;
  let logsSkipped = 0;

  for (let i = 0; i < userCount; i++) {
    const dummy = buildDummyUser(batchId, i);
    if (!dummy.uid.startsWith("dummy_")) {
      throw new HttpsError("failed-precondition", "Generated UID must start with dummy_.");
    }

    createdUserIds.push(dummy.uid);
    const profile = pickProfile(i);

    await db.doc(`users/${dummy.uid}`).set({
      displayName: dummy.displayName,
      username: dummy.username,
      email: `${dummy.username}@dummy.local`,
      setupComplete: true,
      following: [],
      pinnedFollowing: [],
      privacy: {
        calendar: PRIVACY_TIERS[i % 5],
        diary:    PRIVACY_TIERS[Math.floor(i / 5) % 5],
      },
      isDummy: true,
      seedOwnerUid: adminUid,
      seedBatchId: batchId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    usersUpserted++;

    for (const ym of months) {
      const [year, month] = ym.split("-").map(Number);
      const logRef = db.doc(`logs/${ym}/entries/${dummy.uid}`);

      if (!overwrite) {
        const existing = await logRef.get();
        if (existing.exists) {
          logsSkipped++;
          continue;
        }
      }

      const maxDay = includeCurrentMonthToToday && ym === currentYm
        ? Math.min(todayUtcDay, daysInMonth(year, month))
        : daysInMonth(year, month);

      const marksSeed = hashString(`${seed}|${dummy.uid}|${ym}`);
      const marks = buildMarks({
        year,
        month,
        activities: profile.activities,
        chanceByActivity: profile.chances,
        seed: marksSeed,
        dayLimit: maxDay
      });

      await logRef.set({
        userId: dummy.uid,
        yearMonth: ym,
        displayName: dummy.displayName,
        username: dummy.username,
        activities: profile.activities,
        cadences: profile.cadences,
        marks,
        decoration: {
          color: profile.color,
          fontColor: "#FFFFFF",
          font: "Inter",
          sticker: profile.sticker,
          marker: profile.marker,
          avatarUrl: ""
        },
        isDummy: true,
        seedOwnerUid: adminUid,
        seedBatchId: batchId,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: false });

      logsWritten++;
    }

    // ── Seed diary entries (today + yesterday) ──
    const diaryVariant = i % 3;  // 0 = note+photo, 1 = note only, 2 = photo only
    for (let d = 0; d < 2; d++) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d);
      const dateStr = date.getFullYear() + "-"
        + String(date.getMonth() + 1).padStart(2, "0") + "-"
        + String(date.getDate()).padStart(2, "0");
      const diaryRef = db.doc(`diary/${dummy.uid}/entries/${dateStr}`);

      if (!overwrite) {
        const existing = await diaryRef.get();
        if (existing.exists) continue;
      }

      const entry = { lastUpdated: FieldValue.serverTimestamp() };
      if (diaryVariant === 0) {
        entry.note = DUMMY_DIARY_NOTES[(i + d) % DUMMY_DIARY_NOTES.length];
        entry.photoUrl = DUMMY_DIARY_PHOTOS[(i + d) % DUMMY_DIARY_PHOTOS.length];
      } else if (diaryVariant === 1) {
        entry.note = DUMMY_DIARY_NOTES[(i + d) % DUMMY_DIARY_NOTES.length];
      } else {
        entry.photoUrl = DUMMY_DIARY_PHOTOS[(i + d) % DUMMY_DIARY_PHOTOS.length];
      }

      await diaryRef.set(entry, { merge: false });
    }
  }

  const batchSummary = {
    seedBatchId: batchId,
    ownerUid: adminUid,
    isDummyBatch: true,
    userCount,
    usersUpserted,
    logsWritten,
    logsSkipped,
    months,
    overwrite,
    includeCurrentMonthToToday,
    seed,
    createdUserIds,
    createdAt: FieldValue.serverTimestamp()
  };

  await db.doc(`devSeeds/${batchId}`).set(batchSummary, { merge: false });
  await db.doc(`users/${adminUid}`).set({
    lastDummySeedBatchId: batchId,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return {
    ok: true,
    ...batchSummary,
    createdAt: new Date().toISOString()
  };
});

// Commit up to 500 Firestore deletes at a time using a WriteBatch
async function deleteInBatches(refs) {
  const CHUNK = 500;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const chunk = refs.slice(i, i + CHUNK);
    const wb = db.batch();
    for (const ref of chunk) {
      wb.delete(ref);
    }
    await wb.commit();
  }
}

export const adminDeleteDummyBatch = onCall({ region: "asia-southeast1", timeoutSeconds: 120, invoker: "public" }, async (request) => {
  const adminUid = requireAdminAuth(request);
  const payload = request.data || {};
  const seedBatchId = String(payload.seedBatchId || "").trim();

  if (!seedBatchId) {
    throw new HttpsError("invalid-argument", "seedBatchId is required.");
  }

  const batchDocRef = db.doc(`devSeeds/${seedBatchId}`);
  const batchSnap = await batchDocRef.get();
  if (!batchSnap.exists) {
    throw new HttpsError("not-found", "seedBatchId was not found.");
  }

  const batchData = batchSnap.data();
  if (!batchData?.isDummyBatch || batchData.ownerUid !== adminUid) {
    throw new HttpsError("permission-denied", "You can only delete your own dummy batch.");
  }

  const createdUserIds = Array.isArray(batchData.createdUserIds) ? batchData.createdUserIds : [];
  const months = Array.isArray(batchData.months) ? batchData.months : [];

  const skipped = [];
  const logRefs = [];
  const diaryRefs = [];
  const userRefs = [];

  for (const uid of createdUserIds) {
    if (typeof uid !== "string" || !uid.startsWith("dummy_")) {
      skipped.push({ path: `users/${String(uid)}`, code: "invalid-id", message: "Skipped non-dummy or invalid UID." });
      continue;
    }

    for (const ym of months) {
      if (typeof ym !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) {
        skipped.push({ path: `logs/${String(ym)}/entries/${uid}`, code: "invalid-month", message: "Skipped invalid yearMonth key." });
        continue;
      }
      logRefs.push(db.doc(`logs/${ym}/entries/${uid}`));
    }

    userRefs.push(db.doc(`users/${uid}`));

    // Collect diary entries for deletion
    const diarySnap = await db.collection(`diary/${uid}/entries`).listDocuments();
    for (const docRef of diarySnap) {
      diaryRefs.push(docRef);
    }
  }

  try {
    await deleteInBatches([...logRefs, ...diaryRefs, ...userRefs, batchDocRef]);
  } catch (error) {
    throw new HttpsError("internal", `Batch delete failed: ${error?.message || "unknown error"}`);
  }

  return {
    ok: true,
    seedBatchId,
    usersDeleted: userRefs.length,
    logsDeleted: logRefs.length,
    diaryEntriesDeleted: diaryRefs.length,
    skippedCount: skipped.length,
    skipped: skipped.slice(0, 25),
    deletedAt: new Date().toISOString()
  };
});

// ═══════════════════════════════════════════════
// Admin Test Harness
// Console-driven tool for testing feed, privacy, and diary scenarios.
// Accepts actions: markToday, writeDiary, setPrivacy
// ═══════════════════════════════════════════════

export const adminTestHarness = onCall({ region: "asia-southeast1", timeoutSeconds: 30, invoker: "public" }, async (request) => {
  const adminUid = requireAdminAuth(request);
  const { action, uid, payload } = request.data || {};

  if (!action || !uid) {
    throw new HttpsError("invalid-argument", "action and uid are required.");
  }

  if (typeof uid !== "string" || !uid.startsWith("dummy_")) {
    throw new HttpsError("permission-denied", "Test harness can only write to dummy user docs.");
  }

  const now = new Date();
  const yearMonth = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  const todayStr = yearMonth + "-" + String(now.getDate()).padStart(2, "0");
  const todayDay = now.getDate();

  if (action === "markToday") {
    const logRef = db.doc(`logs/${yearMonth}/entries/${uid}`);
    const snap = await logRef.get();

    if (snap.exists) {
      const data = snap.data();
      const activity = payload?.activityName || (data.activities || [])[0];
      if (!activity) throw new HttpsError("failed-precondition", "No activities on this log. Pass activityName in payload.");
      const currentMarks = data.marks?.[activity] || [];
      if (!currentMarks.includes(todayDay)) currentMarks.push(todayDay);
      await logRef.update({
        [`marks.${activity}`]: currentMarks,
        lastUpdated: FieldValue.serverTimestamp(),
      });
      return { ok: true, action, uid, activity, day: todayDay };
    } else {
      const userSnap = await db.doc(`users/${uid}`).get();
      const userData = userSnap.exists ? userSnap.data() : {};
      const activity = payload?.activityName || "Workout";
      await logRef.set({
        userId: uid,
        yearMonth,
        displayName: userData.displayName || "",
        username: userData.username || "",
        activities: [activity],
        cadences: [5],
        marks: { [activity]: [todayDay] },
        decoration: userData.decoration || { color: "#D8584E", fontColor: "#FFFFFF", font: "Inter", sticker: "", marker: "circle", avatarUrl: "" },
        lastUpdated: FieldValue.serverTimestamp(),
      });
      return { ok: true, action, uid, activity, day: todayDay, created: true };
    }
  }

  if (action === "writeDiary") {
    const { note, photoUrl } = payload || {};
    if (!note && !photoUrl) throw new HttpsError("invalid-argument", "Provide at least one of: note, photoUrl in payload.");
    const entry = { lastUpdated: FieldValue.serverTimestamp() };
    if (note) entry.note = note;
    if (photoUrl) entry.photoUrl = photoUrl;
    await db.doc(`diary/${uid}/entries/${todayStr}`).set(entry, { merge: true });
    return { ok: true, action, uid, dateStr: todayStr };
  }

  if (action === "setPrivacy") {
    const validTiers = ["sharing", "followers", "lowkey", "ghost", "private"];
    const { calendar, diary } = payload || {};
    if (calendar && !validTiers.includes(calendar)) throw new HttpsError("invalid-argument", `Invalid calendar tier: ${calendar}`);
    if (diary && !validTiers.includes(diary)) throw new HttpsError("invalid-argument", `Invalid diary tier: ${diary}`);
    const update = {};
    if (calendar) update["privacy.calendar"] = calendar;
    if (diary) update["privacy.diary"] = diary;
    if (Object.keys(update).length === 0) throw new HttpsError("invalid-argument", "Provide at least one of: calendar, diary in payload.");
    await db.doc(`users/${uid}`).update(update);
    return { ok: true, action, uid, update };
  }

  throw new HttpsError("invalid-argument", `Unknown action: ${action}. Use markToday, writeDiary, or setPrivacy.`);
});
