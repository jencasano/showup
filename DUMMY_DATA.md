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
