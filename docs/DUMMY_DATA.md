# Dummy data seeding

There are now two ways to generate dummy data.

## 1) Existing DevTools seeder (single signed-in user)

You can seed three months of realistic tracker data for your current signed-in user.

### What this creates

- Months: `2026-01`, `2026-02`, `2026-03`
- Varying completion patterns so insights and analytics can show different states
  - January: mostly strong consistency
  - February: dip in consistency
  - March: mixed recovery + one extra habit

### How to run

1. Sign into the app.
2. Open browser DevTools Console on the app page.
3. Run:

```js
const { seedQuarter2026 } = await import('/js/dev-seed.js');
await seedQuarter2026();
```

### Useful options

```js
// Preview only (no writes)
await seedQuarter2026({ dryRun: true });

// Overwrite existing Jan–Mar docs for your user
await seedQuarter2026({ overwrite: true });

// Deterministic but different pattern
await seedQuarter2026({ overwrite: true, seed: 1337 });
```

## 2) Admin Tools page (multi-user batch seeding)

Use this when you want many dummy users (e.g., follow-system testing) and easy full-batch delete.

### URL

- `https://showup.jeni.rocks/admin-tools.html` (or local equivalent)

### What it supports

- Configurable number of users
- Configurable start/end months
- Optional “current month through today only”
- Seed value for deterministic generation
- Batch deletion by `seedBatchId`

### Security model

The backend callable functions enforce:

- exact admin UID match (`ADMIN_UID` param)
- expiry window (`ADMIN_TOOL_EXPIRES_AT` param)
- dummy users only (`dummy_*` IDs)
- dummy marker fields (`isDummy`, `seedBatchId`, `seedOwnerUid`)

### Backend functions

- `adminGenerateDummyUsers`
- `adminDeleteDummyBatch`

### Deploy notes

Set Firebase function params before deploying:

```bash
firebase functions:config:set # (if using legacy config, optional)
firebase deploy --only functions,hosting
```

For v2 params, set values with CLI prompts or parameter tooling so `ADMIN_UID` and `ADMIN_TOOL_EXPIRES_AT` are defined in your environment.

## 3) Dev Test Harness (console tool for feed & privacy testing)

Interactive console tool that writes real Firestore data so the app's real-time listeners react naturally.

### How to run

1. Sign into the app.
2. Open browser DevTools Console.
3. Import:

```js
const t = await import('/js/dev-test.js');
```

### Available functions

```js
// List followed users with their UIDs and privacy tiers
await t.listUsers();

// Mark today's calendar for a user (simulates a check-in)
await t.markToday('dummy_abc_01');
await t.markToday('dummy_abc_01', 'Yoga');  // specific activity

// Write a diary entry for today
await t.writeDiary('dummy_abc_01', { note: 'Solid session today.' });
await t.writeDiary('dummy_abc_01', { photoUrl: 'https://picsum.photos/600/400' });
await t.writeDiary('dummy_abc_01', { note: 'Good day!', photoUrl: 'https://picsum.photos/600/400' });

// Change privacy tiers
await t.setPrivacy('dummy_abc_01', { calendar: 'lowkey', diary: 'ghost' });
await t.setPrivacy('dummy_abc_01', { calendar: 'sharing' });  // change one, keep the other
```

### Pre-built scenarios

```js
// Simulates timed updates: calendar mark, wait 5s, then diary write
await t.runScenario('realtime');

// Assigns a spread of calendar x diary tier combos across your followed users
await t.runScenario('privacy-matrix');

// Multiple users update rapidly (tests feed sort order)
await t.runScenario('burst');
```
