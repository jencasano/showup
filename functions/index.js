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

  const userCount = Number(payload.userCount ?? 15);
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

export const adminDeleteDummyBatch = onCall({ region: "asia-southeast1", timeoutSeconds: 120, invoker: "public" }, async (request) => {
  const adminUid = requireAdminAuth(request);
  const payload = request.data || {};
  const seedBatchId = String(payload.seedBatchId || "").trim();

  if (!seedBatchId) {
    throw new HttpsError("invalid-argument", "seedBatchId is required.");
  }

  const batchRef = db.doc(`devSeeds/${seedBatchId}`);
  const batchSnap = await batchRef.get();
  if (!batchSnap.exists) {
    throw new HttpsError("not-found", "seedBatchId was not found.");
  }

  const batch = batchSnap.data();
  if (!batch?.isDummyBatch || batch.ownerUid !== adminUid) {
    throw new HttpsError("permission-denied", "You can only delete your own dummy batch.");
  }

  const createdUserIds = Array.isArray(batch.createdUserIds) ? batch.createdUserIds : [];
  const months = Array.isArray(batch.months) ? batch.months : [];

  let logsDeleted = 0;
  let usersDeleted = 0;
  const skipped = [];

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
      try {
        await db.doc(`logs/${ym}/entries/${uid}`).delete();
        logsDeleted++;
      } catch (error) {
        skipped.push({
          path: `logs/${ym}/entries/${uid}`,
          code: error?.code || "delete-failed",
          message: error?.message || "Delete failed."
        });
      }
    }

    try {
      await db.doc(`users/${uid}`).delete();
      usersDeleted++;
    } catch (error) {
      skipped.push({
        path: `users/${uid}`,
        code: error?.code || "delete-failed",
        message: error?.message || "Delete failed."
      });
    }
  }

  try {
    await batchRef.delete();
  } catch (error) {
    skipped.push({
      path: batchRef.path,
      code: error?.code || "delete-failed",
      message: error?.message || "Delete failed."
    });
  }

  return {
    ok: true,
    seedBatchId,
    usersDeleted,
    logsDeleted,
    skippedCount: skipped.length,
    skipped: skipped.slice(0, 25),
    deletedAt: new Date().toISOString()
  };
});
