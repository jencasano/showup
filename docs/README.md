# showup. documentation

This folder is the canonical home for all design specs, workflow docs, and visual references for showup.

If you are a new collaborator, a future Jeni, or Cii in a fresh chat: **read `ROCKSTACK.md` first, then `MIXTAPE_SPEC.md`.** Everything else is reference.

---

## Start here

**`ROCKSTACK.md`** — the engineering stack, working style, and Cii/VSCii workflow. The "how we work" doc. Always read first in a new chat.

**`MIXTAPE_SPEC.md`** — the design rulebook. Tokens, typography, motion, voice, hard rules. The source of truth for every visual and copy decision. Read this before touching any CSS or user-facing string.

**`playbook.html`** — visual companion to `MIXTAPE_SPEC.md`. Open in a browser to see live swatches (click to copy hex), typography specimens in real fonts, component previews, and motion demos. Same content as the spec, but visual. Deployed at `showup.jeni.rocks/docs/playbook.html`.

---

## Feature specs

**`FOLLOWING_SPEC.md`** — the privacy system. Five tiers, one-way following, per-zone privacy (calendar vs diary), the cascade rules. Read before touching Following tab, All tab, or any privacy logic.

**`FEED_SPEC.md`** — Following Feed behavior. Card states, tier rules for the feed context, real-time upgrades and downgrades. Read before touching feed rendering.

**`FEED_EVENT_SPEC.md`** — the event-stream model behind the feed. Debounce behavior, tier-specific copy, the ~120 copy variants. Sibling to `FEED_SPEC.md`.

**`ALL_TAB_SPEC.md`** — discovery directory. Four card types, search scoring, private cascade at render time.

---

## Reference material

**`FEED_BUILD.md`** — implementation notes from the feed build. Developer reference.

**`DUMMY_DATA.md`** — seed data reference for testing. Developer reference.

---

## Polish-phase specs

**`polish/`** — folder for focused polish specs written during the polish-before-features phase (April 2026 onward). Each file covers one scoped polish pass:

- Login screen (stripe + dots)
- Monthly setup (stickers, markers, badge colors)
- Diary polish (coral to Mixtape red)
- Diary cover system (architecture for 3 defaults + paid covers)
- Toast hierarchy (neutral, info, success, error)
- Scrollbars (token-driven, per-theme)
- Empty states (copy + Mixtape flourish)

New polish specs get added here as we write them. Each file is self-contained and can be shipped independently. Main `MIXTAPE_SPEC.md` remains the top-level rulebook; polish specs are amendments and extensions.

---

## Linking convention

From inside `docs/`, link to sibling files with `./FILENAME.md`.
From outside `docs/` (for example, from `build-log.html` at repo root), link to `docs/FILENAME.md`.
GitHub permalinks for spec-link buttons in `build-log.html` point to `https://github.com/jencasano/showup/blob/main/docs/FILENAME.md`.

---

## Notes for Cii and VSCii

Specs here are canonical. If a spec and the live code disagree, the code is wrong, not the spec. Update the code, or update the spec and then the code. Never silently let them drift apart.

If a design decision is being made in conversation, write it down here as a spec (or an amendment) before implementation starts. Decisions that only exist in chat logs are decisions that will be relitigated in two weeks.

Built by Jen and Cii 🪨
