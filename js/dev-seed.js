import { auth, db } from "./firebase-config.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function buildMarks({ year, month, activities, cadenceMap, chanceByActivity, seed }) {
  const rng = mulberry32(seed);
  const totalDays = daysInMonth(year, month);
  const marks = {};

  activities.forEach((name) => {
    const targetCadence = cadenceMap[name] || 3;
    const monthlyRate = Math.min(0.95, Math.max(0.15, chanceByActivity[name] ?? (targetCadence / 7)));
    const arr = [];

    for (let day = 1; day <= totalDays; day++) {
      if (rng() < monthlyRate) arr.push(day);
    }

    marks[name] = arr;
  });

  return marks;
}

function monthConfig(yearMonth) {
  const configs = {
    "2026-01": {
      activities: ["Workout", "Mobility", "Walk"],
      cadences: [5, 4, 7],
      chanceByActivity: { Workout: 0.8, Mobility: 0.7, Walk: 0.9 },
      decoration: { color: "#80B9B9", fontColor: "#FFFFFF", font: "Inter", sticker: "💪", marker: "check", avatarUrl: "" }
    },
    "2026-02": {
      activities: ["Workout", "Mobility", "Walk"],
      cadences: [5, 4, 7],
      chanceByActivity: { Workout: 0.55, Mobility: 0.4, Walk: 0.75 },
      decoration: { color: "#F8C08A", fontColor: "#1F2937", font: "Inter", sticker: "⚡", marker: "star", avatarUrl: "" }
    },
    "2026-03": {
      activities: ["Workout", "Mobility", "Walk", "Hydration"],
      cadences: [5, 4, 7, 7],
      chanceByActivity: { Workout: 0.68, Mobility: 0.52, Walk: 0.82, Hydration: 0.72 },
      decoration: { color: "#A29BFE", fontColor: "#FFFFFF", font: "Inter", sticker: "🔥", marker: "circle", avatarUrl: "" }
    }
  };

  return configs[yearMonth];
}

export async function seedQuarter2026(options = {}) {
  const {
    userId = auth.currentUser?.uid,
    overwrite = false,
    dryRun = false,
    seed = 2026
  } = options;

  if (!userId) {
    throw new Error("No user is signed in. Sign in first, then call seedQuarter2026().");
  }

  const userSnap = await getDoc(doc(db, "users", userId));
  const userData = userSnap.exists() ? userSnap.data() : {};
  const months = ["2026-01", "2026-02", "2026-03"];
  const result = [];

  for (let i = 0; i < months.length; i++) {
    const yearMonth = months[i];
    const entryRef = doc(db, "logs", yearMonth, "entries", userId);
    const existing = await getDoc(entryRef);

    if (existing.exists() && !overwrite) {
      result.push({ yearMonth, status: "skipped_existing" });
      continue;
    }

    const config = monthConfig(yearMonth);
    const [year, month] = yearMonth.split("-").map(Number);
    const cadenceMap = Object.fromEntries(config.activities.map((a, idx) => [a, config.cadences[idx]]));
    const marks = buildMarks({
      year,
      month,
      activities: config.activities,
      cadenceMap,
      chanceByActivity: config.chanceByActivity,
      seed: seed + i
    });

    const payload = {
      userId,
      yearMonth,
      displayName: userData.displayName || auth.currentUser?.displayName || "",
      username: userData.username || userData.displayName || auth.currentUser?.displayName || "",
      activities: config.activities,
      cadences: config.cadences,
      marks,
      decoration: config.decoration
    };

    if (!dryRun) {
      await setDoc(entryRef, payload, { merge: false });
    }

    result.push({
      yearMonth,
      status: dryRun ? "dry_run" : "written",
      activities: config.activities.length
    });
  }

  return result;
}
