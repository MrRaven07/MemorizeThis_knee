# MemorizeThis — notes for Claude

A **memory gym**: minigames that train memory palace / art of memory techniques (method of loci, chunking, the Major System). The memory palace lives only in the player's head. The app supplies material to memorize and checks recall precisely and fairly. The owner built it for themselves, but anyone can clone it and play. The owner is **learning Vue**, so write clear, idiomatic Vue 3 rather than clever code.

- Approved design: `docs/agents/specs/2026-11-10-vue-rewrite-design.md`
- Plans: `docs/agents/plans/`. Questions and answers: `docs/agents/questions/`.
- Context: `docs/agents/context/architecture.md` (how pieces connect, saved data keys), `docs/agents/context/memory-theory.md` (the theory each game trains). Decisions: `docs/agents/decisions/log.md`.
- Adding a game: follow the `add-minigame` skill (`.claude/skills/add-minigame/SKILL.md`); worked example `src/games/long-number/`.

## Commands

```bash
npm install
npm run dev              # dev server
npx vitest run           # all tests once (npm run test:unit = watch mode)
npm run type-check       # vue-tsc, strict
npm run lint             # oxlint + eslint (auto-fix)
npm run build            # type-check + production build to dist/
```

A task is done only when `npx vitest run && npm run type-check && npm run lint && npm run build` is all green.

## Layout

```
src/
  core/        pure TS, no Vue (except core/timing/useCountdown.ts)
    random/      createRng(seed?) — ALL randomness goes through it
    scoring/     alignStrings(expected, actual) — fair per-character diff
    difficulty/  staircase: initStaircase / stepStaircase / clampStaircase
    timing/      createCountdown (pure), useCountdown (frame-accurate, pauses on hidden tab)
    storage/     StorageAdapter, appStorage, loadJson/saveJson, runMigrations, backup
    session/     createTracker, isExpired, SessionRecord
    format.ts    formatDuration
  games/
    types.ts     GameModule contract, RoundResult, SettingField
    registry.ts  the list of games (the only place a game is registered)
    settings.ts  sanitizeSettings
    <id>/        one folder per game: logic.ts (+ logic.test.ts), <Name>Game.vue, index.ts
  stores/      Pinia: session, settings, stats
  components/  GameShell, TimerBar, RecallInput, ResultDiff, SettingsForm, SessionClock
  views/       HomeView, GameView (hosts any game), SettingsView
  styles/      tokens.css (design tokens), base.css
```

## Rules

- **TypeScript strict. English UI. UTF-8 everywhere.** Compare user strings after `normalize('NFC')`, and split them by code point (`Array.from`), never by UTF-16 index.
- **Games never touch storage.** They emit `round-complete`. GameView records the round through the stats store. Persistence goes only through `src/core/storage`, because on Android (Capacitor, later) the adapter gets swapped.
- **All randomness through `createRng`.** Game components accept an optional `rng` prop so tests can pass a seed.
- **Timing:** use `useCountdown`, never `setInterval`/`setTimeout`, for game phases. It pauses while the tab is hidden and cancels on unmount.
- **Game logic is pure and tested first** (TDD: write the test, watch it fail, then implement).
- **Settings:** games copy `settings` when a round starts, and changes apply from the next round. Every setting is described by a `SettingField`, and values are always passed through `sanitizeSettings` (never NaN).
- **Esc:** a game that uses Esc in a phase calls `event.preventDefault()` in its own window keydown handler. `GameShell` quits only on an Esc nobody handled.
- **Saved data:** keys start with `mt:`. To change a saved shape, add a migration in `core/storage/persist.ts` and bump `SCHEMA_VERSION`. Never delete user data.
- **Theme:** dark only, "Dark focus". Use the CSS variables from `styles/tokens.css` and never hard-coded colors. Mobile-first: check layouts at 400 px width. Everything is playable by keyboard and by touch.
- Vite `base: './'` and hash routing keep the build portable (Capacitor later).

## Git workflow

- Never commit to `main`. Use one branch per milestone (`feat/<thing>`). Push to `origin` when the milestone is green. The owner merges.
- Commit messages end with the `Co-Authored-By` trailer given by the harness.

## Working with the owner

- Questions during a build go to the **manager agent** first and are logged as files in `docs/agents/questions/` (format in its README). Only escalated questions go to the owner.
- Do **not** write `docs/<module>/` explanations. The owner has a separate agent do that after each module ships.
- License: GPL-3.0.
