# Plan 2 — Number Flash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Number Flash minigame: a short number is revealed digit by digit, hidden, then typed back. Its length adapts to the player (staircase).

**Architecture:** Follows `.claude/skills/add-minigame/SKILL.md`. Pure logic in `src/games/number-flash/logic.ts`, a component `NumberFlashGame.vue`, the module in `index.ts`, and a registry entry. The level persists through `useStatsStore().getStaircase / saveStaircase`.

**Tech Stack:** as plan 1 (Vue 3, TS strict, Vitest).

**Spec:** `docs/agents/specs/2026-11-10-vue-rewrite-design.md` §6.2. Rulings: `docs/agents/questions/005`, `006`.

## Global Constraints

- Everything in plan 1's Global Constraints and `CLAUDE.md` applies.
- Branch `feat/number-flash` from `feat/long-number`. Push when Task 3's checks are green.
- Starting length is **4** (staircase `start: 4`, `min: 3`, `max: 30`). After `upAfter` correct answers in a row (setting 3–5, default **3**) the length grows by `upStep` (setting 1–2, default **1**). **Each wrong answer is −1** (`downAfter: 1`, `downStep: 1`) and resets the streak.
- Display time = `max(baseDisplaySeconds·1000 + extraSecondsPerDigit·1000·max(0, length − 4), lastDigitAtMs + 1000)`. Defaults: base **4 s**, extra **0.5 s**, reveal **250 ms/digit**, mode **gradual** (Q005). Digit times are offsets from the round start; the display is driven by `useCountdown`, never chained timeouts.
- No recall time limit. After a result, Enter or **Next** starts the next round directly. Enter is ignored for **300 ms** after the result appears and needs a fresh (non-repeat) keydown (Q006).
- "Correct" means an exact match after removing whitespace.

## Review Focus

1. **The Enter that submits the answer must not also skip the result** (key repeat, a held key). Pinned in Task 2 (`ignores Enter for 300 ms and repeats`).
2. **A slow reveal speed with a long number** must still show the complete number for ≥ 1 s. Pinned in Task 1 (`clamps display so the full number shows ≥ 1 s`).
3. **The level survives reloads**, and a saved level outside [3, 30] is clamped. Pinned in Task 2 (`resumes the saved level`), and clamping is already covered in plan 1 Task 8.
4. **Quitting during the reveal** records nothing and doesn't change the level. Pinned in Task 2 (`unmount during reveal records nothing`).
5. **Settings changed mid-round** (e.g. upAfter) apply from the next round. Pinned in Task 2 (`settings snapshot`).

---

### Task 1: Number Flash logic

**Files:**
- Create: `src/games/number-flash/logic.ts`
- Test: `src/games/number-flash/logic.test.ts`

**Interfaces:**
- Consumes: `Rng`, `randomDigits`; `alignStrings`, `AlignResult`; `StaircaseConfig`; `GameSettings`, `SettingField`, `RoundRecord`, `GameSummary`; `normalizeAnswer` is NOT imported from long-number (games don't import each other). Strip whitespace locally.
- Produces:
  - `interface NumberFlashSettings extends GameSettings { revealMode: 'gradual' | 'all'; revealMsPerDigit: number; baseDisplaySeconds: number; extraSecondsPerDigit: number; upAfter: number; upStep: number }`
  - `NUMBER_FLASH_DEFAULTS = { revealMode: 'gradual', revealMsPerDigit: 250, baseDisplaySeconds: 4, extraSecondsPerDigit: 0.5, upAfter: 3, upStep: 1 }`
  - `NUMBER_FLASH_FIELDS: SettingField[]` — revealMode select (`gradual` "One digit at a time" / `all` "All at once"); revealMsPerDigit 50–2000 step 50 unit ms; baseDisplaySeconds 1–30 step 0.5 unit s; extraSecondsPerDigit 0–3 step 0.25 unit s (help "added per digit beyond 4"); upAfter 3–5 (label "Correct in a row to level up"); upStep 1–2 (label "Digits added per level up")
  - `numberFlashStaircase(s: NumberFlashSettings): StaircaseConfig` → `{ start: 4, min: 3, max: 30, upAfter: s.upAfter, upStep: s.upStep, downAfter: 1, downStep: 1 }`
  - `interface RevealSchedule { digitAtMs: number[]; hideAtMs: number }`
  - `revealSchedule(length: number, s: NumberFlashSettings): RevealSchedule`
  - `visibleDigits(schedule: RevealSchedule, elapsedMs: number): number`
  - `scoreFlash(target: string, input: string): AlignResult`
  - `summarizeNumberFlash(rounds: RoundRecord[]): GameSummary` — headline `longest <n>` (max `metrics.length` over successful rounds), `'no correct answer yet'` if none succeeded, `'not played'` if empty; stats: `Rounds`, `Longest correct` (`<n> digits` or `—`), `Last length` (`level` of the last round), `Success (last 20)` (`<p>%`)

- [ ] **Step 1: Write the failing tests**

```ts
it('defaults are valid against their own fields', () => {
  expect(sanitizeSettings(NUMBER_FLASH_DEFAULTS, NUMBER_FLASH_DEFAULTS, NUMBER_FLASH_FIELDS)).toEqual(NUMBER_FLASH_DEFAULTS)
})
it('staircase config follows the spec', () => {
  expect(numberFlashStaircase({ ...NUMBER_FLASH_DEFAULTS, upAfter: 5, upStep: 2 }))
    .toEqual({ start: 4, min: 3, max: 30, upAfter: 5, upStep: 2, downAfter: 1, downStep: 1 })
})
it('gradual schedule: one digit per step, 4 s for 4 digits', () => {
  expect(revealSchedule(4, NUMBER_FLASH_DEFAULTS)).toEqual({ digitAtMs: [0, 250, 500, 750], hideAtMs: 4000 })
})
it('adds the per-digit extra beyond 4 digits', () => {
  expect(revealSchedule(6, NUMBER_FLASH_DEFAULTS).hideAtMs).toBe(5000)
  expect(revealSchedule(3, NUMBER_FLASH_DEFAULTS).hideAtMs).toBe(4000)
})
it('all-at-once schedule shows every digit at 0', () => {
  expect(revealSchedule(5, { ...NUMBER_FLASH_DEFAULTS, revealMode: 'all' }).digitAtMs).toEqual([0, 0, 0, 0, 0])
})
it('clamps display so the full number shows ≥ 1 s', () => {
  const s = revealSchedule(12, { ...NUMBER_FLASH_DEFAULTS, revealMsPerDigit: 800 }) // last digit at 8800
  expect(s.hideAtMs).toBe(9800)
})
it('visibleDigits counts digits whose time has come', () => {
  const sch = revealSchedule(4, NUMBER_FLASH_DEFAULTS)
  expect(visibleDigits(sch, 0)).toBe(1); expect(visibleDigits(sch, 499)).toBe(2); expect(visibleDigits(sch, 5000)).toBe(4)
})
it('scoreFlash ignores whitespace and requires exact digits', () => {
  expect(scoreFlash('4819', ' 48 19 ').exact).toBe(true); expect(scoreFlash('4819', '4818').exact).toBe(false)
})
it('summary', () => {
  const mk = (len: number, success: boolean): RoundRecord => ({ id: `${len}${success}`, gameId: 'number-flash', at: 0, sessionId: null, success, level: len, accuracy: success ? 1 : 0.5, durationMs: 1, metrics: { length: len, correct: 0 } })
  const s = summarizeNumberFlash([mk(4, true), mk(5, true), mk(6, false)])
  expect(s.headline).toBe('longest 5')
  expect(s.stats).toEqual([
    { label: 'Rounds', value: '3' }, { label: 'Longest correct', value: '5 digits' },
    { label: 'Last length', value: '6' }, { label: 'Success (last 20)', value: '67%' },
  ])
  expect(summarizeNumberFlash([]).headline).toBe('not played')
  expect(summarizeNumberFlash([mk(4, false)]).headline).toBe('no correct answer yet')
})
```

- [ ] **Step 2: Run** `npx vitest run src/games/number-flash` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `logic.ts`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `git switch -c feat/number-flash` (first time), then `git commit -m "feat(number-flash): reveal schedule, scoring and staircase config"`.

---

### Task 2: Number Flash game screen

**Files:**
- Create: `src/games/number-flash/NumberFlashGame.vue`
- Test: `src/games/number-flash/NumberFlashGame.test.ts`

**Interfaces:**
- Consumes: Task 1; `useCountdown`; `useStatsStore().getStaircase(gameId, cfg) / saveStaircase(gameId, state)`; `stepStaircase`; `RecallInput`, `ResultDiff`, `TimerBar`; `createRng`.
- Produces: props `{ settings: NumberFlashSettings; rng?: Rng }`; emits `'round-complete'` and `'level'` (emitted on mount with the saved level, and after every round with the new level). `NUMBER_FLASH_ID = 'number-flash'` is exported from `logic.ts` and used for the staircase key.

Phases: `ready` ("Length N · Enter to start") → `show` (digits revealed per schedule; the screen shows `visibleDigits` digits plus placeholder dots for the rest so the width doesn't jump; Esc / Skip = `finishNow`, with `preventDefault`) → `recall` (`RecallInput` numeric; Enter submits) → `result` (`ResultDiff`; "Length 4 → 5" or "Length 4 (streak 2/3)"; **Next** button). On submit: score, step the staircase (with the round's settings snapshot), save it, emit `round-complete` `{ success, level: playedLength, accuracy, durationMs: recall time, metrics: { length, correct } }`, then emit `level` with the new level.

- [ ] **Step 1: Write the failing tests** (setup: storage mocked with a memory adapter as in plan 1, fresh Pinia, fake timers incl. `performance` and rAF, seeded `rng = createRng(1)`; expected digits = `randomDigits(createRng(1), 4)`)
  - `plays a round`: emits `level` 4 on mount; Start → after 0 ms one digit visible (`.digit.shown` count 1); after 800 ms 4 shown; after 4050 ms the input is present; typing the digits + Enter → `.diff-match` × 4, `round-complete` matches `{ success: true, level: 4 }`, text contains `streak 1/3`.
  - `three correct in a row level up`: play 3 correct rounds (Next between) → the last `level` emitted is 5 and `useStatsStore().getStaircase('number-flash', numberFlashStaircase(NUMBER_FLASH_DEFAULTS)).level` is 5.
  - `a wrong answer levels down`: 1 wrong round → `level` 3.
  - `ignores Enter for 300 ms and repeats`: after a submit, dispatch Enter on `window` at +100 ms → still `result`; dispatch Enter with `repeat: true` at +400 ms → still `result`; plain Enter at +400 ms → the `show` phase (a `.digit` exists).
  - `resumes the saved level`: `saveStaircase('number-flash', { level: 7, streakRight: 0, streakWrong: 0 })` before mount → `level` 7 emitted and the ready text says `Length 7`.
  - `unmount during reveal records nothing`: Start, advance 500 ms, unmount → no `round-complete`, and the saved staircase is unchanged.
  - `settings snapshot`: Start with `upAfter: 3`, `setProps` to `upAfter: 5` mid-round, answer correctly → text contains `streak 1/3`.
- [ ] **Step 2: Run** `npx vitest run src/games/number-flash` — Expected: FAIL.
- [ ] **Step 3: Implement** the component.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(number-flash): playable game screen"`

---

### Task 3: Register, verify, push

**Files:**
- Create: `src/games/number-flash/index.ts` (`numberFlash: GameModule<NumberFlashSettings>`: id `number-flash`, name `Number Flash`, tagline `A short number flashes. Type it back — it grows as you improve.`, trains `Fast encoding of short digit sequences (digit span)`)
- Modify: `src/games/registry.ts` (append `numberFlash` after `longNumber`), `README.md` (tick Number Flash)

- [ ] **Step 1: Add a registry test** to `src/games/registry.test.ts`: `games.map(g => g.id)` equals `['long-number', 'number-flash']`, and ids are unique. Run it and watch it fail.
- [ ] **Step 2: Implement** `index.ts` and the registry entry; run it and watch it pass.
- [ ] **Step 3: Full checks** `npx vitest run && npm run type-check && npm run lint && npm run build && npm run format` — Expected: all green.
- [ ] **Step 4: Commit and push** `git commit -m "feat(number-flash): register game"` and `git push -u origin feat/number-flash`.
