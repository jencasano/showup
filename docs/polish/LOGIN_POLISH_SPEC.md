# Login Polish Spec

Scoped polish pass for the login screen and its adjacent toasts. Focuses on three specific issues that survived Mixtape Phase 1/2 and need cleanup before the icon pass or broader toast rework begin.

This spec is a **scoped amendment** to `MIXTAPE_SPEC.md`. The Mixtape spec remains the top-level rulebook. Anything not addressed here defers to it.

---

## 1. Context

The login screen shipped clean in Mixtape Phase 1/2 for the most part. Wordmark renders correctly with `show[up].` and the red "up" highlight. Tagline "Show up. Period." is present. The red Sign in button uses the hero red token. Side A and Side B both load without obvious regressions.

Three issues remain visible:

1. **Login dots** — the decorative row under the Sign in button uses a legacy teal hex (`#80B9B9`) that is not theme-aware, so it reads slightly off on Side B.
2. **Sign-out toast** — the copy and punctuation violate Mixtape voice rules.
3. **"Failed to load following" error toast** — appears on the login screen immediately after a user signs out, caused by a teardown race. The toast is both visually out of place (shows on login, for a thing the logged-out user can't act on) and uses copy that should not exist in the app.

This spec resolves all three.

---

## 2. Login dots

### 2.1 Current state

`css/login.css` defines three classes on `.login-dot`:

- base (no modifier) → `background: var(--border);` (hairline tan)
- `.filled` → `background: var(--color-primary);` (Mixtape red, theme-correct)
- `.teal` → `background: var(--color-teal);`

`css/variables.css` currently defines `--color-teal: #80B9B9;` as a **legacy hardcoded hex** on both Side A and Side B. This is the old coral/teal theme's teal, not the Mixtape Side B teal (`#5EAAA8`) and not anywhere in the Side A Mixtape palette at all.

Result: on Side B the teal dots read as "a slightly-off color from the old theme" rather than as part of the locked palette.

The dot pattern in `index.html` is a 7-dot decoration:

```
filled, teal, plain, filled, plain, teal, filled
```

This pattern is unchanged by this spec.

### 2.2 Fix

**In `css/variables.css`:**

Replace the single hardcoded `--color-teal` alias with two new tokens that behave correctly per theme.

On Side A (default `:root` and `[data-theme="side-a"]`), introduce a semantic token for the supporting dot color that maps to the Mixtape blue (`#4F6C8E`).

On Side B (`[data-theme="side-b"]`), override that same token so it resolves to the Mixtape teal (`#5EAAA8`).

Choose a token name that describes the role, not the hue. A name like `--dot-support` or `--accent-support` is appropriate. Reserve naming conventions for the toast spec; whichever name is used here should also work there when we reach it.

### 2.3 Update login.css

Change `.login-dot.teal` so it reads from the new token instead of `var(--color-teal)`.

Keep the `.teal` class name for now. Renaming it to `.support` or similar would match the token name better but ripples into `index.html` and adds scope for little gain. If the toast spec later decides to unify class naming across the app, we can rename in one sweep.

### 2.4 Legacy alias

`--color-teal` remains defined at this time because other code may still reference it. Do not remove it in this commit. A separate cleanup pass after the toast spec will sweep all remaining `--color-teal` references and retire the alias.

---

## 3. Sign-out toast

### 3.1 Current state

In `js/app.js`, both the desktop sidebar sign-out button (`#sb-signout-btn`) and the mobile avatar menu sign-out button (`#signout-btn`) share a handler that fires:

```
showToast("Signed out!", "info");
```

Two violations of the Mixtape voice rules (`MIXTAPE_SPEC.md` §2):

- **Exclamation point.** Voice rule: "No exclamation points unless the moment is genuinely celebratory." Signing out is the opposite of celebratory.
- **Capitalization.** The intentionally-lowercase guidance calls out toasts explicitly as a lowercase context: `saved.` / `synced.` / `couldn't save.` The sign-out toast should follow the same lowercase-with-period pattern.

### 3.2 Fix

Change the toast string to:

```
signed out.
```

Lowercase, trailing period, no exclamation. Same toast type (`info`). Same firing point. Only the string changes.

Do the same anywhere else the app currently shows a capitalized-exclamation toast for a non-celebratory event. Do not change toasts that are genuinely celebratory (streak hit, milestone, first-ever) if those exist yet.

---

## 4. The "Failed to load following" toast (logout race)

### 4.1 Current state

When a user signs out while the Following tab is active, the following sequence fires:

1. User clicks Sign out.
2. Firebase Auth begins the sign-out flow.
3. The active `onSnapshot` listener in `loadFollowingLogs()` (held in `followingUnsub`) is still live.
4. Firestore security rules reject the next snapshot tick because the user is no longer authenticated.
5. The error handler inside `loadFollowingLogs()` fires a toast: `"Failed to load following."`
6. The login screen is now visible, so this toast pops up on the login screen against the maroon Side B background, confusing the user. This is visible in live testing (see repo screenshot history).

The toast string also violates voice rules:
- Capital F (see §3.1 lowercase-toasts rule).
- "Failed to" is alarm-flavored (see `MIXTAPE_SPEC.md` §2 error-message guidance: "Direct, kind, specific. Never alarming.").

### 4.2 Fix, part A — suppress during logout

In `js/tracker-following.js` (or wherever `loadFollowingLogs` lives and the error toast is emitted), detect when the error is a **logout-race error** rather than a genuine failure.

Two ways to detect logout-race:

- Check if `auth.currentUser` is `null` or `undefined` at the moment the error fires. If so, suppress the toast silently. The listener should clean itself up.
- Alternatively, check the Firestore error code. Logout-race errors typically come through as `permission-denied` with a specific message. If the listener was active and the user is now gone, the error is expected and should be swallowed.

Either detection approach is acceptable. VSCii picks whichever is cleaner given the surrounding code.

Additionally, in `js/app.js` sign-out handler, make sure `followingUnsub` and `allLogsUnsub` are both called and cleared **before** `signOutUser()` returns, so Firestore has no active listeners at the moment auth flips to null. This is a defense-in-depth measure on top of the error-suppression above.

### 4.3 Fix, part B — if a real load failure does fire

Keep an error toast for real failures (network error during a fresh load, etc.), but:

- The user must still be authenticated when the toast fires (gate on `auth.currentUser` being truthy).
- The copy must match `MIXTAPE_SPEC.md` §7 error-state style.

Use this copy:

```
couldn't load following. try again?
```

Lowercase, trailing period, trailing question mark where it helps. Same voice as the documented error-state table in the spec.

Apply the same treatment to the parallel "failed to load all" toast if one exists in `tracker-all.js` (I have not verified; worth a grep). Target copy for that one:

```
couldn't load all. try again?
```

---

## 5. Out of scope

Things intentionally parked, to avoid scope creep:

- **Broader toast system rework.** Toast color tokens, toast hierarchy (neutral / info / success / error / warning), toast icons, toast positioning. All of that is the subject of the upcoming `TOAST_SPEC.md`. This login spec only fixes the specific toasts that fire adjacent to the login screen.
- **Login screen visual redesign.** The layout, typography, spacing, and button styling are all Mixtape-correct and stay as-is. This spec is a color-and-copy pass, not a layout pass.
- **Loader polish.** The global loader (backlog item 17, "Custom spinner") is a separate task.
- **Dot animation.** The dots are static. Deciding whether they should breathe, pulse, or shimmer is a future creative exploration, not part of this polish pass.

---

## 6. Implementation checklist for VSCii

When this spec is ready to ship, the complete set of changes is:

- **`css/variables.css`** — add a support-color token (name it something role-descriptive like `--dot-support` or `--accent-support`); set it to `var(--blue)` on Side A, `var(--teal)` on Side B. Do not remove `--color-teal` yet.
- **`css/login.css`** — point `.login-dot.teal` at the new token.
- **`js/app.js`** — update the sign-out toast string to `signed out.` with lowercase, trailing period, no exclamation.
- **`js/tracker-following.js`** — detect logout-race errors and suppress the toast; keep a real error toast for genuine failures and use the corrected copy.
- **`js/tracker-all.js`** (if applicable) — same pattern if a parallel toast exists.
- Commit message: `feat(polish): login dots + toast voice fix`

No new files. No HTML changes. No test changes. Should be one self-contained commit.

---

## 7. Voice review checklist

Before shipping, confirm against the Mixtape copy review checklist (`MIXTAPE_SPEC.md` §2):

- [ ] Would a friend say this? (signed out. yes. couldn't load following. yes.)
- [ ] Any em-dashes? (no)
- [ ] Any exclamation points for non-celebratory events? (no)
- [ ] Any "the user" language? (no)
- [ ] Any AI-ish phrasing? (no)
- [ ] Lowercase-appropriate where called for? (yes, all three toasts)

---

Built by Jen and Cii 🪨
