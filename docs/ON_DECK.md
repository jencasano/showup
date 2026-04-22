# On-deck

> Running list of polish, features, and fixes queued for future rounds.
> Live source of truth (replaces the list that used to live only in the project context).
> Items are numbered for reference. Closed items move to the bottom with a date stamp.

---

## Active

### 1. Tab spinners
Spinner shows unnecessarily on instant tab switches. Add logic to skip the spinner when content is already in cache or the switch is under a threshold (maybe 150ms). Owner: polish round.

### 2. Past-month lock
Once a month has passed, logging should be disabled (read-only). Past months stay viewable but activities cannot be toggled. Needs an "archived" visual treatment on the calendar card. Owner: feature round.

### 3. Manage Activities
Gear icon on the card badge opens a panel to rename, delete, or add activities for the current month only. Past months stay frozen. Needs careful UX around mid-month edits (does renaming propagate to existing logs?). Owner: feature round.

### 4. Pinned cards left-to-right order
CSS columns fills top-to-bottom, so pinned cards read top-down instead of left-to-right. Revisit when CSS Masonry has wider browser support (`grid-template-rows: masonry` is still experimental). Owner: CSS polish when browsers catch up.

### 5. Optimistic upload UX
Close the diary modal instantly on Save, upload photo in background, show "saving..." then "saved." toast. Currently the modal stays open while the photo uploads, which feels sluggish on slow connections. Owner: diary polish round.

### 6. Safari Fit mode blur
Canvas downscale/upscale tuning needed on iOS Safari. Images come out slightly blurry in Fit mode on Safari specifically. Likely a devicePixelRatio issue. Owner: bug fix.

### 7. Diary polaroid square in desktop modal
Desktop modal read view currently shows the polaroid at its original aspect ratio. Make it square (same as mobile) for consistency. Owner: diary polish round.

### 8. Storage region migration to asia-southeast1
Firebase Storage is currently on the free tier default bucket (us-central1 multi-region). Uploads from the Philippines have high latency. Migration to a regional bucket (asia-southeast1) requires upgrading to the paid Blaze plan. Worth doing once we have paying users or are close to launch. Owner: infra round.

### 9. Feed card UI polish
Zone divider missing between activity zone and diary zone on feed cards. Also: double "diary." label (zone label row and renderDiaryStrip both render it, remove the outer one). Owner: feed polish round.

### 10. Feed per-day diary fetch
Feed currently fetches the latest-ever diary entry for a user, not the specific entry for that card's date. Needs date-scoped query. Owner: feed fix round.

### 11. Feed changed zone rendering
Handle the "log removed" and "diary removed" states. If a user deletes a log but keeps the diary, the calendar zone should show a "changed" message. If diary removed but log stays, diary zone should degrade gracefully. Spec in FEED_SPEC.md. Owner: feed feature round.

### 12. Feed milestone cards
Streak hits, first day back after a break ("comeback"), first day of a month. Milestone cards appear in the feed when someone you follow hits one. Copy should feel warm, not gamified. Owner: feature round.

### 13. All tab card tap
Currently no-op. Activates when user profile pages are built. Owner: feature round (depends on profile pages).

### 14. Diary Phase B
Swipe between pages (horizontal gesture on mobile), per-habit photo reel view (filter by activity). Bigger feature, own scoping round. Owner: feature round.

### 15. Diary Phase C
Social diary pages for followers. Diary content becomes shareable to followers under the existing privacy tiers. Full spec needed when we get there. Owner: feature round, dependent on user profile pages and social infra.

### 16. Multi-photo diary entries
**Refined (Apr 22, 2026):** Up to 3 photos per entry for free tier, up to 10 photos per entry for paid tier. Stored as `entitlements/{uid}.photoLimit` (values: 3 or 10). Entitlements schema already supports this (see DIARY_COVER_SYSTEM_SPEC section 3). Design work needed: single-photo polaroid is the current visual anchor, so multi-photo needs its own pattern (stacked polaroids? scrapbook collage? secondary-position thumbnails?). Upgrade moment triggers when free user adds a 4th photo. Own polish round, tentatively `PHOTOS_SPEC`. Owner: feature round.

### 17. Custom spinner/loader for showup
Replace the generic Firebase-default spinner with a showup-branded one. Maybe the 4-point Mixtape sparkle spinning, or a subtle paper-flip animation. Small polish but high brand value. Owner: polish round.

### 18. Polish + landing screen
Marketing-facing landing at showup.jeni.rocks root for unauthenticated visitors. Currently hits login directly. Needs hero, value prop, preview of the product, sign-up CTA. Own full spec round. Owner: marketing round.

### 19. Settings panel (Phase 3)
Full Settings panel with Account (display name edit, email, sign out), Diary (cover gallery, default cover), App (theme, language), Privacy (all privacy tiers), Notifications. Deferred from PO04. Owner: Phase 3.

### 20. Display name edit for post-setup users
Partially addressed by PO04 (back nav from Step 2 to Step 1 gives first-time users a chance to edit). For users already past setup, this lives in the Settings panel (item 19). Owner: Phase 3.

### 21. Shop (Phase 4)
Paid cover designs, paid photo limit, paid sticker packs, Stripe or Apple IAP integration, Cloud Function for entitlements writes. PO04 lays the schema; Shop builds the UI and payment pipeline. Owner: Phase 4.

---

## Closed

*(Items move here with a date stamp when shipped. Format: ~~Item~~ Apr 22, 2026 · PO04.)*

---

*Last updated April 22, 2026. Maintained by Jen & Cii.* 🪨
