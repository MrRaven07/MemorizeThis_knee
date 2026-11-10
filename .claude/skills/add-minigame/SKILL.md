---
name: add-minigame
description: Use when adding a new minigame module to MemorizeThis (a new game folder under src/games/ that shows up in the home menu)
---

# Add a minigame to MemorizeThis

Every game is a self-contained module plugged into a shared core. If you need to edit core code to add a game, stop and ask the manager agent first (log it in `docs/agents/questions/`).

**Worked example: `src/games/long-number/`.** Read it before starting.

## 0. Check the idea against the theory

Read `docs/agents/context/memory-theory.md`. Write down which memory skill the game trains and how its difficulty should scale. If the spec or plan for this game leaves a gap, ask the manager agent (question file first).

## 1. Branch

```bash
git switch -c feat/<game-id>
```

## 2. Logic first (TDD), in `src/games/<game-id>/logic.ts`

Write `logic.test.ts` first, watch it fail, then implement. The logic is **pure TypeScript with no Vue imports**:

- A settings interface extending `GameSettings`, plus `<GAME>_DEFAULTS` and `<GAME>_FIELDS: SettingField[]`. Test that the defaults survive `sanitizeSettings(defaults, defaults, fields)` unchanged.
- Generation that takes an `Rng` (`src/core/random/rng.ts`), never `Math.random`. Test with a fixed seed.
- Scoring. For typed recall use `alignStrings` (`src/core/scoring/align.ts`). Normalize input (strip whitespace, NFC is already done) before scoring.
- For adaptive difficulty, a `StaircaseConfig` (`src/core/difficulty/staircase.ts`). The component loads and saves the state through `useStatsStore().getStaircase / saveStaircase`.
- `summarize<Game>(rounds: RoundRecord[]): GameSummary`. Its `headline` appears on the home tile and must say `'not played'` when there are no rounds.

## 3. The component, `src/games/<game-id>/<Name>Game.vue`

Contract (`src/games/types.ts`):

- Props `{ settings: <Settings>; rng?: Rng }`. Default `rng` to `createRng()`, and inject a seeded one in tests.
- **Snapshot settings when a round starts** (`round.value = { ...props.settings }`). Changes apply next round.
- Emit `'round-complete'` once per finished round with a `RoundResult`. Optionally emit `'level'` for the header.
- Phases run with `useCountdown()` (`src/core/timing/useCountdown.ts`):
  `if ((await countdown.start(ms)) === 'cancelled') return`. Never use `setInterval` for game timing.
- Use the shared UI: `TimerBar`, `RecallInput` (`inputmode="numeric"` for digits), `ResultDiff`. `GameShell` is added by `GameView`, so don't wrap yourself in it.
- Keyboard: `useGameKeys((e) => …)` from `src/core/keyboard/useGameKeys.ts`. Never use your own `window` listener. It already skips handled events and keys typed into inputs or selects. If you use **Esc** in a phase, call `e.preventDefault()` so the shell doesn't quit. Enter starts or continues.
- Styling: scoped CSS using only `src/styles/tokens.css` variables. Mobile-first, and check it at 400 px.
- **Never touch storage.** No `localStorage`, no `appStorage`.

Component test (`<Name>Game.test.ts`): dispatch keys on `document.body` with `bubbles: true`; fake timers with `toFake: ['setTimeout','clearTimeout','requestAnimationFrame','cancelAnimationFrame','performance','Date']`, a seeded `rng`, a full round, skip/Esc precedence, and settings changed mid-round.

## 4. Register it

- `src/games/<game-id>/index.ts` exports `const <game>: GameModule<Settings>` with `id`, `name`, `tagline`, `trains`, `defaultSettings`, `settingsFields`, `component: () => import('./<Name>Game.vue')` and `summarize`.
- Add it to the `games` array in `src/games/registry.ts`, in menu order.

## 5. Verify, then commit and push

```bash
npx vitest run && npm run type-check && npm run lint && npm run build
npm run format
```

All green, then commit and push: `git push -u origin feat/<game-id>`. Never push to `main`; the owner merges.

## Checklist

- [ ] Every test was seen failing before its implementation
- [ ] No `Math.random`, `setInterval`, `localStorage` or hard-coded colors in the game folder
- [ ] Settings snapshot per round, and blank or 0 settings still start a sane round
- [ ] Esc / Enter behave as described above
- [ ] The home tile headline works with 0 rounds
- [ ] Don't write `docs/<game-id>/`; the owner has another agent do that
