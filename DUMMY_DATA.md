# Dummy data seeding (Jan–Mar 2026)

You can seed three months of realistic tracker data for your current signed-in user.

## What this creates

- Months: `2026-01`, `2026-02`, `2026-03`
- Varying completion patterns so insights and analytics can show different states
  - January: mostly strong consistency
  - February: dip in consistency
  - March: mixed recovery + one extra habit

## How to run

1. Sign into the app.
2. Open browser DevTools Console on the app page.
3. Run:

```js
const { seedQuarter2026 } = await import('/js/dev-seed.js');
await seedQuarter2026();
```

## Useful options

```js
// Preview only (no writes)
await seedQuarter2026({ dryRun: true });

// Overwrite existing Jan–Mar docs for your user
await seedQuarter2026({ overwrite: true });

// Deterministic but different pattern
await seedQuarter2026({ overwrite: true, seed: 1337 });
```

## Notes

- Existing monthly docs are **not overwritten** unless `overwrite: true`.
- Data is written to: `logs/{yearMonth}/entries/{yourUserId}`.
- This is intended for local/dev testing and analytics validation.
