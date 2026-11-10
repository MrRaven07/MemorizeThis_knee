# Plan 1 — Foundation + Long Number Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mockup with a Vue 3 + TypeScript app that has the shared core (RNG, timing, difficulty, scoring, storage, sessions), the game-module system, the shared UI and pages, and one complete game (Long Number) built on top of it.

**Architecture:** Pure TypeScript logic lives in `src/core/` and in each game's `logic.ts` (no Vue imports, unit-tested with injected clocks and seeded RNG). Pinia stores wrap core logic plus persistence. Each game is a folder in `src/games/<id>/` exporting a `GameModule` that `src/games/registry.ts` lists. `GameView` hosts any module inside the shared `GameShell`, and games report finished rounds through an emitted event that the view writes to the stats store.

**Tech Stack:** Vue 3, TypeScript (strict), Vite, Vue Router, Pinia, Vitest + @vue/test-utils + jsdom, ESLint + Prettier, npm.

**Spec:** `docs/agents/specs/2026-11-10-vue-rewrite-design.md`

**Later plans** (written after this one ships, one per milestone): 2 Number Flash · 3 License Plates (+ `add-plate-country` skill) · 4 Maze · 5 Card Match · 6 Major System Flashcards · 7 Stats page + session summary · 8 Cleanup/polish.

## Global Constraints

- Vue 3 + TypeScript `strict` + Vite; npm; local Node 26 / npm 12.
- English UI copy. All user text is UTF-8; compare user strings after `String.prototype.normalize('NFC')`; split by code point (`Array.from`), never by UTF-16 index.
- Dark-only theme in the "Dark focus" direction: near-black background, monospace digits, one bright green accent, thin borders. All colors/spacing/type come from CSS custom properties in `src/styles/tokens.css`.
- Mobile-first, touch-friendly; every screen fully keyboard-playable (Enter submits, Esc quits/skips).
- Android-ready later via Capacitor: Vite `base: './'`, no hard-coded absolute asset paths, persistence only through `src/core/storage`.
- Games never read/write storage directly; they use stores. All randomness goes through `src/core/random`.
- Timing via `performance.now()` + `requestAnimationFrame`; never `setInterval` for game timing.
- License GPL-3.0 (already in place). Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never commit to `main`. Branch `feat/foundation` (Tasks 1–10) from `docs/rewrite-design`; branch `feat/long-number` (Tasks 11–13) from `feat/foundation`. Push each branch to `origin` when its last task's checks pass.

## Review Focus

1. **Blank / zero / negative / non-numeric settings** (the old mockup's NaN bug) → values are clamped to the field's min/max and fall back to the default; a round never starts with `NaN`. Pinned in Task 9 (`SettingsForm` test) and Task 8 (`sanitizeSettings` test).
2. **Pasted or sloppy recall input** (spaces, newlines, trailing text) in Long Number → whitespace is stripped before scoring; non-digits count as wrong characters, nothing crashes. Pinned in Task 11.
3. **Tab hidden mid-memorize** → the countdown pauses and resumes; hidden time is not counted as viewing time, nor as active session time. Pinned in Task 5 and Task 7.
4. **Corrupt JSON or a future schema version in storage** → nothing is wiped; the raw value is preserved under `<key>.corrupt`; the app falls back to defaults and still loads. Pinned in Task 6.
5. **Quitting mid-round** (Quit button, browser back) → timers are cancelled, no round is recorded, session activity stops, no console errors. Pinned in Task 10 (`GameView` test).

---

### Task 1: Scaffold the Vue project and remove the mockup

**Files:**
- Delete: `css/`, `js/`, `pages/`, `assets/`, (already-deleted) `src/index.html`, `src/script.js`, `src/style.css`
- Create (from create-vue, then trimmed): `package.json`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `tsconfig*.json`, `eslint.config.ts`, `.prettierrc.json`, `env.d.ts`, `src/main.ts`, `src/App.vue`, `src/router/index.ts`
- Create: `src/styles/tokens.css`, `src/styles/base.css`, `src/App.test.ts`
- Modify: `README.md` (add "Run it" section), `.gitignore` (merge create-vue's entries with the existing ones)

**Interfaces:**
- Produces: `npm run dev | build | test:unit | lint | type-check | format` scripts; `@/` alias to `src/`; CSS tokens named `--bg`, `--surface`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent-dim`, `--danger`, `--warning`, `--font-ui`, `--font-mono`, `--radius`, `--space-1..6`.

- [ ] **Step 1: Branch and scaffold in the scratchpad** (create-vue's `--force` empties the target folder, so never run it in the repo)

```bash
git switch -c feat/foundation
cd "$SCRATCHPAD" && npm create vue@latest mt-scaffold -- --ts --router --pinia --vitest --eslint-with-prettier --bare
```
Expected: `mt-scaffold/` created with no prompts. If `--bare` is unknown to the installed create-vue, drop it and delete the example components/views/stores/tests by hand in Step 2.

- [ ] **Step 2: Copy the scaffold into the repo** (everything except `README.md`, `.git`, `node_modules`), delete the mockup folders listed above, delete create-vue's sample components/views/stores/assets, and set `base: './'` in `vite.config.ts`. Then run `npm install`.

- [ ] **Step 3: Write `src/styles/tokens.css` and `src/styles/base.css`** — dark focus palette (bg `#0d1117`, surface `#161b22`, border `#30363d`, text `#e6edf3`, muted `#8b949e`, accent `#7ee787`, danger `#f85149`, warning `#d29922`), `--font-mono: ui-monospace, "JetBrains Mono", "Cascadia Code", Menlo, monospace`, `color-scheme: dark`, `prefers-reduced-motion` disables transitions. Import both in `src/main.ts`. `App.vue` is just `<RouterView />` inside a centered, max-width `main`.

- [ ] **Step 4: Write the smoke test** `src/App.test.ts`

```ts
it('mounts the app shell with a router view', async () => {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<p>home</p>' } }] })
  router.push('/'); await router.isReady()
  const w = mount(App, { global: { plugins: [router, createPinia()] } })
  expect(w.text()).toContain('home')
})
```

- [ ] **Step 5: Verify the toolchain**

Run: `npx vitest run && npm run type-check && npm run lint && npm run build`
Expected: 1 test passes, no type or lint errors, `dist/` produced.

- [ ] **Step 6: README "Run it" section** — `git clone …`, `npm install`, `npm run dev`, `npm run test:unit`, `npm run build`; note Node ≥ 20.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vue 3 + TS app and remove the mockup"
```

---

### Task 2: Seedable RNG

**Files:**
- Create: `src/core/random/rng.ts`
- Test: `src/core/random/rng.test.ts`

**Interfaces:**
- Produces:
  - `interface Rng { next(): number /* [0,1) */; int(min: number, max: number): number /* inclusive */; pick<T>(items: readonly T[]): T; shuffle<T>(items: readonly T[]): T[] /* new array */ }`
  - `createRng(seed?: number): Rng` — mulberry32; no seed → seed from `crypto.getRandomValues`.
  - `randomDigits(rng: Rng, length: number): string`

- [ ] **Step 1: Write the failing tests**

```ts
it('is deterministic for a seed', () => {
  const a = createRng(42), b = createRng(42)
  expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()])
})
it('int stays inside inclusive bounds and hits both ends', () => {
  const r = createRng(1); const seen = new Set<number>()
  for (let i = 0; i < 2000; i++) { const v = r.int(3, 5); expect(v).toBeGreaterThanOrEqual(3); expect(v).toBeLessThanOrEqual(5); seen.add(v) }
  expect([...seen].sort()).toEqual([3, 4, 5])
})
it('shuffle returns a permutation and does not mutate input', () => {
  const input = [1, 2, 3, 4, 5]; const out = createRng(7).shuffle(input)
  expect(input).toEqual([1, 2, 3, 4, 5]); expect([...out].sort()).toEqual(input)
})
it('randomDigits returns only digits of the requested length', () => {
  expect(randomDigits(createRng(3), 25)).toMatch(/^\d{25}$/)
  expect(randomDigits(createRng(3), 0)).toBe('')
})
```

- [ ] **Step 2: Run** `npx vitest run src/core/random` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** in `src/core/random/rng.ts` (mulberry32 for `next`; Fisher–Yates for `shuffle`).
- [ ] **Step 4: Run** `npx vitest run src/core/random` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(core): seedable RNG"`

---

### Task 3: Alignment scoring

**Files:**
- Create: `src/core/scoring/align.ts`
- Test: `src/core/scoring/align.test.ts`

**Interfaces:**
- Produces:
  - `type DiffOp = { kind: 'match'; char: string } | { kind: 'substitute'; expected: string; actual: string } | { kind: 'missing'; expected: string } | { kind: 'extra'; actual: string }`
  - `interface AlignResult { ops: DiffOp[]; correct: number; expectedLength: number; accuracy: number; exact: boolean }`
  - `alignStrings(expected: string, actual: string): AlignResult`

Rules: both strings NFC-normalized and split by code point. Levenshtein DP with unit costs; on backtrace tie prefer match/substitute, then missing, then extra. `accuracy = correct / (expectedLength + extraCount)`, and `1` when both are empty. `exact` = every op is `match` and lengths are equal.

- [ ] **Step 1: Write the failing tests**

```ts
it('a skipped digit only costs that digit', () => {
  const r = alignStrings('12345', '1245')
  expect(r.ops.map(o => o.kind)).toEqual(['match', 'match', 'missing', 'match', 'match'])
  expect(r.correct).toBe(4); expect(r.accuracy).toBeCloseTo(0.8); expect(r.exact).toBe(false)
})
it('an extra digit is penalised', () => {
  const r = alignStrings('123', '1923')
  expect(r.ops.map(o => o.kind)).toEqual(['match', 'extra', 'match', 'match'])
  expect(r.accuracy).toBeCloseTo(0.75)
})
it('a wrong digit is a substitution', () => {
  expect(alignStrings('123', '193').ops[1]).toEqual({ kind: 'substitute', expected: '2', actual: '9' })
})
it('exact match and empty strings', () => {
  expect(alignStrings('8080', '8080')).toMatchObject({ exact: true, accuracy: 1, correct: 4 })
  expect(alignStrings('', '')).toMatchObject({ exact: true, accuracy: 1 })
  expect(alignStrings('12', '')).toMatchObject({ exact: false, accuracy: 0, correct: 0 })
})
it('treats decomposed and composed diacritics as equal', () => {
  expect(alignStrings('sanie ș', 'sanie ș').exact).toBe(true)
})
```

- [ ] **Step 2: Run** `npx vitest run src/core/scoring` — Expected: FAIL.
- [ ] **Step 3: Implement** `alignStrings` in `src/core/scoring/align.ts`.
- [ ] **Step 4: Run** `npx vitest run src/core/scoring` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(core): alignment-based recall scoring"`

---

### Task 4: Adaptive difficulty staircase

**Files:**
- Create: `src/core/difficulty/staircase.ts`
- Test: `src/core/difficulty/staircase.test.ts`

**Interfaces:**
- Produces:
  - `interface StaircaseConfig { start: number; min: number; max: number; upAfter: number; upStep: number; downAfter: number; downStep: number }`
  - `interface StaircaseState { level: number; streakRight: number; streakWrong: number }`
  - `initStaircase(cfg: StaircaseConfig): StaircaseState`
  - `stepStaircase(state: StaircaseState, cfg: StaircaseConfig, correct: boolean): StaircaseState` (pure; returns a new object)
  - `clampStaircase(state: StaircaseState, cfg: StaircaseConfig): StaircaseState` (for saved states after a config change)

- [ ] **Step 1: Write the failing tests** (cfg `{ start: 4, min: 3, max: 6, upAfter: 3, upStep: 1, downAfter: 1, downStep: 1 }`)

```ts
it('rises after upAfter correct answers in a row and resets the streak', () => {
  let s = initStaircase(cfg); s = stepStaircase(s, cfg, true); s = stepStaircase(s, cfg, true)
  expect(s.level).toBe(4); s = stepStaircase(s, cfg, true)
  expect(s).toEqual({ level: 5, streakRight: 0, streakWrong: 0 })
})
it('a wrong answer lowers by downStep and resets the right-streak', () => {
  let s = stepStaircase(stepStaircase(initStaircase(cfg), cfg, true), cfg, false)
  expect(s).toEqual({ level: 3, streakRight: 0, streakWrong: 0 })
})
it('never leaves [min, max]', () => {
  let s = { level: 3, streakRight: 0, streakWrong: 0 }; s = stepStaircase(s, cfg, false); expect(s.level).toBe(3)
  s = { level: 6, streakRight: 2, streakWrong: 0 }; s = stepStaircase(s, cfg, true); expect(s.level).toBe(6)
})
it('upStep 2 jumps two levels', () => {
  const c2 = { ...cfg, max: 30, upStep: 2 }; let s = initStaircase(c2)
  for (let i = 0; i < 3; i++) s = stepStaircase(s, c2, true)
  expect(s.level).toBe(6)
})
it('clamp pulls an out-of-range saved level back inside', () => {
  expect(clampStaircase({ level: 99, streakRight: 1, streakWrong: 0 }, cfg).level).toBe(6)
})
```

- [ ] **Step 2: Run** `npx vitest run src/core/difficulty` — Expected: FAIL.
- [ ] **Step 3: Implement.** `streakWrong` counts consecutive misses; the level drops once it reaches `downAfter`, then the counter resets.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(core): adaptive difficulty staircase"`

---

### Task 5: Precise countdown

**Files:**
- Create: `src/core/timing/countdown.ts` (pure), `src/core/timing/useCountdown.ts` (Vue composable)
- Test: `src/core/timing/countdown.test.ts`, `src/core/timing/useCountdown.test.ts`

**Interfaces:**
- Produces:
  - `type Clock = () => number` and `defaultClock: Clock` (`performance.now`)
  - `createCountdown(durationMs: number, clock?: Clock): Countdown` where `interface Countdown { remaining(): number; elapsed(): number; progress(): number /* 0..1 elapsed */; isDone(): boolean; pause(): void; resume(): void; isPaused(): boolean }`. It starts running when created.
  - `useCountdown(opts?: { pauseWhenHidden?: boolean /* default true */; clock?: Clock }): { remainingMs: Ref<number>; progress: Ref<number>; running: Ref<boolean>; start(durationMs: number): Promise<'done' | 'cancelled'>; finishNow(): void; cancel(): void }`. A rAF loop updates the refs; `finishNow` resolves `'done'` (the Skip button); `cancel` resolves `'cancelled'`; it listens to `visibilitychange` when `pauseWhenHidden`; it cancels on `onScopeDispose`. `start` while running cancels the previous run first.

- [ ] **Step 1: Write the failing pure tests** (fake clock: `let t = 0; const clock = () => t`)

```ts
it('counts down against the clock', () => {
  const c = createCountdown(4000, clock); t = 1000
  expect(c.remaining()).toBe(3000); expect(c.progress()).toBeCloseTo(0.25)
})
it('pause freezes time and resume continues', () => {
  const c = createCountdown(4000, clock); t = 1000; c.pause(); t = 5000
  expect(c.remaining()).toBe(3000); c.resume(); t = 6000
  expect(c.remaining()).toBe(2000)
})
it('is done at zero and never goes negative', () => {
  const c = createCountdown(4000, clock); t = 9000
  expect(c.isDone()).toBe(true); expect(c.remaining()).toBe(0); expect(c.progress()).toBe(1)
})
```

- [ ] **Step 2: Write the failing composable test** — with `vi.useFakeTimers()` (also fakes `requestAnimationFrame`/`performance`) inside an `effectScope`: `start(1000)` resolves `'done'` after advancing 1000 ms; when `document.visibilityState` is mocked as `'hidden'` and `visibilitychange` is dispatched at 400 ms, advancing 5000 ms leaves `running` true and `remainingMs ≈ 600`; then going visible and advancing 600 ms resolves `'done'`. A second test: `cancel()` resolves `'cancelled'`, and so does `scope.stop()` (the dispose path).

- [ ] **Step 3: Run** `npx vitest run src/core/timing` — Expected: FAIL.
- [ ] **Step 4: Implement** both files.
- [ ] **Step 5: Run** — Expected: PASS.
- [ ] **Step 6: Commit** `git commit -m "feat(core): precise pausable countdown"`

---

### Task 6: Storage adapter, schema migrations, backup

**Files:**
- Create: `src/core/storage/adapter.ts`, `src/core/storage/persist.ts`, `src/core/storage/backup.ts`
- Test: `src/core/storage/persist.test.ts`, `src/core/storage/backup.test.ts`

**Interfaces:**
- Produces:
  - `interface StorageAdapter { get(key: string): string | null; set(key: string, value: string): void; remove(key: string): void; keys(): string[] }`
  - `createMemoryAdapter(initial?: Record<string, string>): StorageAdapter`, `createLocalStorageAdapter(): StorageAdapter`
  - `KEY_PREFIX = 'mt:'`, `VERSION_KEY = 'mt:version'`, `SCHEMA_VERSION = 1`
  - `type Migration = (a: StorageAdapter) => void`; `migrations: Record<number, Migration>` (key `n` upgrades `n-1 → n`; entry `1` just sets up v1)
  - `runMigrations(a: StorageAdapter, list?: Record<number, Migration>, target?: number): 'ok' | 'future-version'`
  - `loadJson<T>(a: StorageAdapter, key: string, fallback: T): T` — on a parse error, copies the raw value to `${key}.corrupt` (if not already there) and returns `fallback`
  - `saveJson(a: StorageAdapter, key: string, value: unknown): void`
  - `exportAll(a: StorageAdapter): string` → `{"app":"memorize-this","exportedAt":<ms>,"version":1,"data":{<all mt: keys>}}`
  - `importAll(a: StorageAdapter, json: string): { ok: true } | { ok: false; error: string }` — validates `app` and that `version <= SCHEMA_VERSION`, writes the data keys, then runs migrations
  - `appStorage: StorageAdapter` — the singleton the stores use (localStorage in the browser)

- [ ] **Step 1: Write the failing tests**

```ts
it('fresh storage migrates to the current version', () => {
  const a = createMemoryAdapter(); expect(runMigrations(a)).toBe('ok'); expect(a.get(VERSION_KEY)).toBe('1')
})
it('runs pending migrations in order', () => {
  const a = createMemoryAdapter({ 'mt:version': '1' }); const log: number[] = []
  runMigrations(a, { 1: () => log.push(1), 2: () => log.push(2), 3: () => log.push(3) }, 3)
  expect(log).toEqual([2, 3]); expect(a.get(VERSION_KEY)).toBe('3')
})
it('a future version is left untouched', () => {
  const a = createMemoryAdapter({ 'mt:version': '9', 'mt:rounds': '[1]' })
  expect(runMigrations(a)).toBe('future-version'); expect(a.get('mt:rounds')).toBe('[1]'); expect(a.get(VERSION_KEY)).toBe('9')
})
it('corrupt JSON falls back and keeps the raw text', () => {
  const a = createMemoryAdapter({ 'mt:rounds': '{oops' })
  expect(loadJson(a, 'mt:rounds', [])).toEqual([]); expect(a.get('mt:rounds.corrupt')).toBe('{oops')
})
it('backup round-trips UTF-8 data', () => {
  const a = createMemoryAdapter({ 'mt:version': '1', 'mt:x': JSON.stringify({ w: 'zeamă ș ț' }), other: 'ignored' })
  const b = createMemoryAdapter(); expect(importAll(b, exportAll(a))).toEqual({ ok: true })
  expect(JSON.parse(b.get('mt:x')!)).toEqual({ w: 'zeamă ș ț' }); expect(b.get('other')).toBeNull()
})
it('import rejects foreign or newer files without writing', () => {
  const b = createMemoryAdapter()
  expect(importAll(b, '{"app":"x"}').ok).toBe(false)
  expect(importAll(b, '{"app":"memorize-this","version":99,"data":{"mt:a":"1"}}').ok).toBe(false)
  expect(b.keys()).toEqual([])
})
```

- [ ] **Step 2: Run** `npx vitest run src/core/storage` — Expected: FAIL.
- [ ] **Step 3: Implement** the three files. The localStorage adapter wraps every call in try/catch (private mode) and degrades to an in-memory map.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(core): versioned storage adapter with backup/restore"`

---

### Task 7: Session tracking (core + store)

**Files:**
- Create: `src/core/session/tracker.ts`, `src/stores/session.ts`
- Test: `src/core/session/tracker.test.ts`, `src/stores/session.test.ts`

**Interfaces:**
- Consumes: `Clock` (Task 5), `appStorage`, `loadJson`, `saveJson` (Task 6), `createRng` is NOT needed (ids from `crypto.randomUUID()`).
- Produces:
  - `IDLE_TIMEOUT_MS = 30 * 60_000`
  - `interface SessionRecord { id: string; startedAt: number /* epoch ms */; endedAt: number | null; activeMs: number; rounds: number; perGameMs: Record<string, number> }`
  - `createTracker(clock?: Clock): { start(gameId: string): void; stop(): void; isActive(): boolean; activeMs(): number; perGameMs(): Record<string, number> }` (active time = sum of start→stop spans, live span included)
  - `isExpired(lastActivityAt: number, now: number, idleMs?: number): boolean`
  - `useSessionStore()` — state `current: SessionRecord | null`, `sessions: SessionRecord[]` (finished, persisted under `mt:sessions`); getters `liveActiveMs` (refreshed by a 1 s ticker for display only) and `isActive: boolean`; actions `beginActivity(gameId: string)`, `endActivity()`, `noteRound()`, `endSession(): SessionRecord | null`. `beginActivity` creates a session if none exists or if the last one expired (expired ones are finalized first). `endActivity` is also called on `visibilitychange → hidden`, and `beginActivity` again on visible if a game is mounted.

- [ ] **Step 1: Write the failing tests**

```ts
it('counts only active spans, per game', () => {
  let t = 0; const tr = createTracker(() => t)
  tr.start('long-number'); t = 5000; tr.stop(); t = 9000; tr.start('number-flash'); t = 10000
  expect(tr.activeMs()).toBe(6000); expect(tr.perGameMs()).toEqual({ 'long-number': 5000, 'number-flash': 1000 })
})
it('expires after 30 idle minutes', () => {
  expect(isExpired(0, 30 * 60_000 - 1)).toBe(false); expect(isExpired(0, 30 * 60_000)).toBe(true)
})
```
Store test (memory adapter injected via `setActivePinia(createPinia())` and mocking `appStorage` with `vi.mock`): `beginActivity('long-number')` creates `current`; `noteRound()` increments `rounds`; `endSession()` returns the record with `endedAt` set, pushes it to `sessions` and persists it; a second `beginActivity` after `vi.setSystemTime(+31 min)` finalizes the old session and opens a new one with a different `id`.

- [ ] **Step 2: Run** `npx vitest run src/core/session src/stores/session` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(core): active-time session tracking"`

---

### Task 8: Game module contract, registry, settings & stats stores

**Files:**
- Create: `src/games/types.ts`, `src/games/registry.ts`, `src/games/settings.ts`, `src/stores/settings.ts`, `src/stores/stats.ts`
- Test: `src/games/settings.test.ts`, `src/stores/stats.test.ts`

**Interfaces:**
- Consumes: `StaircaseConfig`, `StaircaseState`, `initStaircase`, `clampStaircase` (Task 4); storage (Task 6); `useSessionStore().noteRound` (Task 7).
- Produces (in `src/games/types.ts`):
  - `type SettingValue = number | boolean | string`; `type GameSettings = Record<string, SettingValue>`
  - `type SettingField = { key: string; label: string; help?: string } & ({ type: 'number'; min: number; max: number; step?: number; unit?: string } | { type: 'boolean' } | { type: 'select'; options: { value: string; label: string }[] })`
  - `interface RoundResult { success: boolean; level: number | null; accuracy: number | null; durationMs: number; metrics: Record<string, number> }`
  - `interface RoundRecord extends RoundResult { id: string; gameId: string; at: number; sessionId: string | null }`
  - `interface GameSummary { headline: string; stats: { label: string; value: string }[] }`
  - `interface GameModule<S extends GameSettings = GameSettings> { id: string; name: string; tagline: string; trains: string; defaultSettings: S; settingsFields: SettingField[]; component: () => Promise<Component>; summarize(rounds: RoundRecord[]): GameSummary }`
  - Game component contract: props `{ settings: S }`; emits `'round-complete': [result: RoundResult]`.
- Produces (elsewhere):
  - `src/games/registry.ts`: `export const games: GameModule[] = []` (Long Number is added in Task 12) and `getGame(id: string): GameModule | undefined`
  - `src/games/settings.ts`: `sanitizeSettings<S extends GameSettings>(raw: unknown, defaults: S, fields: SettingField[]): S` — unknown keys dropped; wrong type / NaN / missing → default; numbers clamped to [min, max] and rounded to `step` (default 1); select values not in `options` → default
  - `useSettingsStore()` — `mazeKeys: 'wasd' | '1234'` (default `'wasd'`), `gameSettings<S>(module: GameModule<S>): S` (sanitized), `setGameSettings(gameId: string, s: GameSettings)`; persisted under `mt:settings`
  - `useStatsStore()` — `rounds: RoundRecord[]` (persisted under `mt:rounds`), `staircases: Record<string, StaircaseState>` (under `mt:progress`); `recordRound(gameId: string, r: RoundResult): RoundRecord` (also calls `noteRound`), `roundsFor(gameId: string): RoundRecord[]`, `getStaircase(gameId: string, cfg: StaircaseConfig): StaircaseState` (init or clamp), `saveStaircase(gameId: string, s: StaircaseState): void`

- [ ] **Step 1: Write the failing tests**

```ts
const fields: SettingField[] = [
  { key: 'n', label: 'N', type: 'number', min: 1, max: 50 },
  { key: 'sep', label: 'Sep', type: 'boolean' },
  { key: 'keys', label: 'Keys', type: 'select', options: [{ value: 'wasd', label: 'WASD' }, { value: '1234', label: '1234' }] },
]
const defaults = { n: 10, sep: true, keys: 'wasd' }
it.each([[{ n: '' }], [{ n: NaN }], [{ n: 'abc' }], [{}], [null]])('bad number %j falls back to default', raw => {
  expect(sanitizeSettings(raw, defaults, fields).n).toBe(10)
})
it('clamps and rounds numbers', () => {
  expect(sanitizeSettings({ n: 0 }, defaults, fields).n).toBe(1)
  expect(sanitizeSettings({ n: -5 }, defaults, fields).n).toBe(1)
  expect(sanitizeSettings({ n: 999 }, defaults, fields).n).toBe(50)
  expect(sanitizeSettings({ n: 7.6 }, defaults, fields).n).toBe(8)
})
it('rejects unknown select values and drops unknown keys', () => {
  expect(sanitizeSettings({ keys: 'zzz', junk: 1 }, defaults, fields)).toEqual(defaults)
})
```
Stats store: `recordRound('long-number', {...})` returns a record with `gameId`, a string `id` and a numeric `at`, persists it, and increments the session's `rounds`; `getStaircase` returns `initStaircase(cfg)` the first time and the saved (clamped) state after `saveStaircase`.

- [ ] **Step 2: Run** `npx vitest run src/games src/stores/stats` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: game module contract, registry, settings and stats stores"`

---

### Task 9: Shared UI components

**Files:**
- Create: `src/components/TimerBar.vue`, `RecallInput.vue`, `ResultDiff.vue`, `SettingsForm.vue`, `SessionClock.vue`, `GameShell.vue`, `src/core/format.ts`
- Test: `src/components/SettingsForm.test.ts`, `src/components/RecallInput.test.ts`, `src/components/ResultDiff.test.ts`, `src/core/format.test.ts`

**Interfaces:**
- Consumes: `DiffOp` (Task 3), `SettingField`, `sanitizeSettings` (Task 8), `useSessionStore` (Task 7).
- Produces:
  - `formatDuration(ms: number): string` → `"0:07"`, `"12:40"`, `"1:02:03"` (h:mm:ss once ≥ 1 h)
  - `TimerBar` — props `{ progress: number }` (0..1 elapsed); shrinking accent bar, `role="progressbar"`
  - `RecallInput` — props `{ modelValue: string; inputmode?: 'numeric' | 'text'; placeholder?: string; label: string }`; emits `update:modelValue`, `submit`; Enter → `submit`; autofocuses on mount; `autocomplete="off"`, `autocapitalize="off"`, `spellcheck="false"`; monospace and large
  - `ResultDiff` — props `{ ops: DiffOp[] }`; one span per op with class `diff-match | diff-substitute | diff-missing | diff-extra`; missing shows the expected char struck/dimmed, substitute shows the actual char with the expected one as a title/tooltip
  - `SettingsForm` — props `{ fields: SettingField[]; modelValue: GameSettings; defaults: GameSettings }`; emits `update:modelValue` with **sanitized** values on change/blur (never NaN)
  - `SessionClock` — shows `formatDuration(session.liveActiveMs)` when a session exists
  - `GameShell` — props `{ title: string; level?: string | number | null }`; emits `quit`, `open-settings`; slot `default`; calls `session.beginActivity(gameId)` on mount and `endActivity()` on unmount (prop `gameId: string`); Esc emits `quit` unless an input inside the slot has focus

- [ ] **Step 1: Write the failing tests**

```ts
// format
expect(formatDuration(7_000)).toBe('0:07'); expect(formatDuration(760_000)).toBe('12:40'); expect(formatDuration(3_723_000)).toBe('1:02:03')
// SettingsForm: clearing a number field emits the default, typing 0 emits min
const w = mount(SettingsForm, { props: { fields, modelValue: defaults, defaults } })
await w.find('input[name="n"]').setValue(''); await w.find('input[name="n"]').trigger('change')
expect(w.emitted('update:modelValue')!.at(-1)![0]).toMatchObject({ n: 10 })
await w.find('input[name="n"]').setValue('0'); await w.find('input[name="n"]').trigger('change')
expect(w.emitted('update:modelValue')!.at(-1)![0]).toMatchObject({ n: 1 })
// RecallInput: Enter emits submit
const r = mount(RecallInput, { props: { modelValue: '12', label: 'Answer' } })
await r.find('input').trigger('keydown', { key: 'Enter' }); expect(r.emitted('submit')).toHaveLength(1)
// ResultDiff
const d = mount(ResultDiff, { props: { ops: alignStrings('123', '13').ops } })
expect(d.findAll('.diff-match')).toHaveLength(2); expect(d.findAll('.diff-missing')).toHaveLength(1)
```

- [ ] **Step 2: Run** `npx vitest run src/components src/core/format` — Expected: FAIL.
- [ ] **Step 3: Implement** the components with scoped CSS using only tokens.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(ui): shared game components"`

---

### Task 10: Pages and routing

**Files:**
- Create: `src/views/HomeView.vue`, `src/views/GameView.vue`, `src/views/SettingsView.vue`
- Modify: `src/router/index.ts`, `src/main.ts` (run `runMigrations(appStorage)` before mounting; if `'future-version'`, show a blocking notice instead of the app: "Your saved data is from a newer version of MemorizeThis. Update the app to continue." and don't touch storage)
- Create: `CLAUDE.md` (first version: what the project is, commands, folder map, the Global Constraints above, git workflow; Task 13 extends it)
- Test: `src/views/GameView.test.ts`, `src/views/HomeView.test.ts`

**Interfaces:**
- Consumes: registry (Task 8), stores (Tasks 7–8), components (Task 9), `exportAll`/`importAll` (Task 6).
- Produces routes: `/` → Home, `/play/:gameId` → GameView (unknown id → redirect `/`), `/settings` → Settings, catch-all → `/`. Route names `home`, `play`, `settings`.
  - **Home:** title, `SessionClock`, a tile grid from `games` (name, tagline, `summarize(roundsFor(id)).headline`), and a Settings link. With no games: "No games yet."
  - **GameView:** resolves the module, loads its component (`defineAsyncComponent`), wraps it in `GameShell`, passes `settings` from the settings store, and has a settings drawer (`SettingsForm`) that saves via `setGameSettings`. On `round-complete` it calls `stats.recordRound(gameId, result)`. Quit → `router.push('/')`.
  - **Settings:** maze key set (`wasd` / `1234`) and **Backup / Restore all data**. The backup is offered as a downloaded `memorize-this-backup-YYYY-MM-DD.json` (Blob + object URL); restore uses a file input and `importAll`, and shows the error text when it fails. On success it reloads the stores.

- [ ] **Step 1: Write the failing tests**
  - `HomeView`: with the registry mocked to contain a fake module `{ id: 'fake', name: 'Fake', summarize: () => ({ headline: 'best 3', stats: [] }) … }`, it renders "Fake" and "best 3" and links to `/play/fake`; with an empty registry it renders "No games yet."
  - `GameView`: with a fake module whose component emits `round-complete` on a button click, clicking it makes `stats.rounds` length 1 with `gameId: 'fake'`. A fake component that starts a `useCountdown` and then has Quit clicked: navigation goes to `/`, `stats.rounds` stays empty, `session.isActive` is false, and no unhandled rejection is raised (`vi.spyOn(console, 'error')` not called).

- [ ] **Step 2: Run** `npx vitest run src/views` — Expected: FAIL.
- [ ] **Step 3: Implement** the views, router and `main.ts` migration gate; write `CLAUDE.md` v1.
- [ ] **Step 4: Run the full suite and checks**

Run: `npx vitest run && npm run type-check && npm run lint && npm run build`
Expected: all green.

- [ ] **Step 5: Manual check** — `npm run dev`, open the URL: Home shows "No games yet.", Settings shows the key-set selector, and Backup downloads a JSON file. Check at 400 px width too.
- [ ] **Step 6: Commit and push the foundation branch**

```bash
git add -A && git commit -m "feat: home, game host and settings pages"
git push -u origin feat/foundation
```

---

### Task 11: Long Number logic

**Files:**
- Create: `src/games/long-number/logic.ts`
- Test: `src/games/long-number/logic.test.ts`

**Interfaces:**
- Consumes: `Rng`, `randomDigits` (Task 2); `alignStrings`, `AlignResult` (Task 3).
- Produces:
  - `interface LongNumberSettings extends GameSettings { groups: number; digitsPerGroup: number; separateGroups: boolean; memorizeSeconds: number; delaySeconds: number; recallSeconds: number }`
  - `LONG_NUMBER_DEFAULTS: LongNumberSettings = { groups: 1, digitsPerGroup: 10, separateGroups: true, memorizeSeconds: 15, delaySeconds: 5, recallSeconds: 0 }` (`recallSeconds: 0` = no limit)
  - `LONG_NUMBER_FIELDS: SettingField[]` — groups 1–20; digitsPerGroup 1–40; separateGroups boolean; memorizeSeconds 1–600; delaySeconds 0–600; recallSeconds 0–600 (help: "0 = no limit")
  - `generateGroups(rng: Rng, s: LongNumberSettings): string[]`
  - `formatGroups(groups: string[], separate: boolean): string` (separator is a thin space ` `, purely visual)
  - `normalizeAnswer(input: string): string` (removes all Unicode whitespace)
  - `scoreLongNumber(groups: string[], input: string): AlignResult`
  - `summarizeLongNumber(rounds: RoundRecord[]): GameSummary` — headline `best <n>` where n = the largest `metrics.length` among rounds with `success`, or `"not played"`; stats: Rounds, Best (100%), Average accuracy of the last 10 (as a %)

- [ ] **Step 1: Write the failing tests**

```ts
it('generates the configured shape', () => {
  const g = generateGroups(createRng(5), { ...LONG_NUMBER_DEFAULTS, groups: 3, digitsPerGroup: 4 })
  expect(g).toHaveLength(3); g.forEach(x => expect(x).toMatch(/^\d{4}$/))
})
it('formats with or without visual separators', () => {
  expect(formatGroups(['12', '34'], true)).toBe('12 34'); expect(formatGroups(['12', '34'], false)).toBe('1234')
})
it('ignores spaces and newlines in the answer', () => {
  expect(scoreLongNumber(['1234', '5678'], ' 1234 5678\n').exact).toBe(true)
})
it('counts letters as wrong characters, not a crash', () => {
  const r = scoreLongNumber(['123'], '1a3'); expect(r.correct).toBe(2); expect(r.exact).toBe(false)
})
it('summary headline uses the longest perfect round', () => {
  const mk = (len: number, success: boolean) => ({ id: String(len), gameId: 'long-number', at: 0, sessionId: null, success, level: null, accuracy: success ? 1 : 0.5, durationMs: 1, metrics: { length: len } })
  expect(summarizeLongNumber([mk(10, true), mk(24, true), mk(30, false)]).headline).toBe('best 24')
  expect(summarizeLongNumber([]).headline).toBe('not played')
})
```

- [ ] **Step 2: Run** `npx vitest run src/games/long-number` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** (on a new branch) `git switch -c feat/long-number && git add -A && git commit -m "feat(long-number): generation and scoring logic"`

---

### Task 12: Long Number game screen and registration

**Files:**
- Create: `src/games/long-number/LongNumberGame.vue`, `src/games/long-number/index.ts`
- Modify: `src/games/registry.ts` (add `longNumber`)
- Test: `src/games/long-number/LongNumberGame.test.ts`

**Interfaces:**
- Consumes: Task 11 exports; `useCountdown` (Task 5); `TimerBar`, `RecallInput`, `ResultDiff` (Task 9); `createRng` (Task 2); the game component contract (Task 8).
- Produces: `LongNumberGame` props `{ settings: LongNumberSettings; rng?: Rng }` (`rng` defaults to `createRng()`, injectable for tests); `longNumber: GameModule<LongNumberSettings>` with `id: 'long-number'`, `name: 'Long Number'`, `tagline: 'Memorize one long number, then type it back.'`, `trains: 'Chunking and memory-palace placement of long digit strings'`.

Screen phases: `ready` (shows "N digits · Xs to memorize" + Start; Enter starts) → `memorize` (formatted number in `--font-mono`, `TimerBar`, **Skip** button / Esc = `finishNow`) → `delay` (only if `delaySeconds > 0`; "Get ready…" + `TimerBar`) → `recall` (`RecallInput inputmode="numeric"`, Finish button / Enter; `TimerBar` only if `recallSeconds > 0`, auto-finish at zero) → `result` (`ResultDiff`, "You got C of N digits (P%)", **Play again** returns to `ready` with a new number). On entering `result`, emit `round-complete` with `{ success: exact, level: null, accuracy, durationMs: <recall phase length>, metrics: { length: totalDigits, correct } }`.

- [ ] **Step 1: Write the failing component test** (fake timers; settings `{ ...LONG_NUMBER_DEFAULTS, digitsPerGroup: 4, memorizeSeconds: 1, delaySeconds: 0 }`; RNG seeded through a `rng` prop defaulting to `createRng()`, seed 1): click Start → the number is visible; advance 1000 ms → the recall input is present and the number is gone; type the number shown and press Enter → `.diff-match` count is 4, and `emitted('round-complete')[0][0]` matches `{ success: true, accuracy: 1, metrics: { length: 4, correct: 4 } }`. Second test: Skip during memorize goes straight to recall.

- [ ] **Step 2: Run** `npx vitest run src/games/long-number` — Expected: FAIL.
- [ ] **Step 3: Implement** the component, `index.ts` (wires `LONG_NUMBER_DEFAULTS`, `LONG_NUMBER_FIELDS`, `summarizeLongNumber`, lazy `component`) and the registry entry.
- [ ] **Step 4: Run the full suite and checks** — `npx vitest run && npm run type-check && npm run lint && npm run build` — Expected: all green.
- [ ] **Step 5: Manual check** — `npm run dev`: play two rounds (one perfect, one with a skipped digit — the diff should show only that digit as missing); the Home tile shows `best <n>`; the session clock ticks only while on the game screen; change settings to blank/0 values and confirm the round still starts sanely. Check at 400 px width.
- [ ] **Step 6: Commit** `git commit -am "feat(long-number): playable game screen"`

---

### Task 13: Agent support files

**Files:**
- Modify: `CLAUDE.md` (finalize)
- Create: `.claude/skills/add-minigame/SKILL.md`, `docs/agents/context/architecture.md`, `docs/agents/context/memory-theory.md`, `docs/agents/decisions/log.md`
- Modify: `README.md` (roadmap: tick "skeleton", list the six modules with status)

**Interfaces:**
- Consumes: the real file names and signatures from Tasks 2–12 (the docs must quote them exactly).

Content requirements:
- `CLAUDE.md`: purpose (memory gym; palace lives in the player's head), commands, folder map, the Global Constraints, the "games never touch storage / all randomness via core/random / logic is pure + tested" rules, git workflow (branch per milestone, push when green, never `main`, owner merges), "don't write `docs/<module>/` — the owner has another agent do that", and pointers to `docs/agents/`.
- `add-minigame/SKILL.md`: frontmatter `name: add-minigame`, `description: Use when adding a new minigame module to MemorizeThis`; steps: spec check against `memory-theory.md` → folder `src/games/<id>/` → `logic.ts` + tests first (TDD) → settings defaults + fields → component honoring the props/emit contract and using `useCountdown`/`GameShell`/shared components → `index.ts` module → registry entry → `summarize` → full checks → manual check at 400 px → commit/push on `feat/<id>`. Use Long Number as the worked example with file paths.
- `architecture.md`: core ↔ stores ↔ games ↔ views diagram (Mermaid), the data keys (`mt:version`, `mt:settings`, `mt:rounds`, `mt:progress`, `mt:sessions`) and the migration rule ("add a migration, bump `SCHEMA_VERSION`, never delete user data").
- `memory-theory.md`: method of loci / memory palace, chunking, the Major System, spaced repetition / the box system, and for each planned module which skill it trains and how difficulty should scale.
- `decisions/log.md`: dated entries for Vue+TS, Pinia/Router/Vitest, sync storage adapter (localStorage works inside Capacitor's WebView; revisit if moving to async Preferences), alignment scoring, staircase, the dark-only theme, GPL-3.0.

- [ ] **Step 1: Write the files.**
- [ ] **Step 2: Verify** that every path and function name quoted in the docs exists: `grep -ohE 'src/[A-Za-z0-9/_.-]+' CLAUDE.md docs/agents/context/*.md .claude/skills/*/SKILL.md | sort -u | xargs ls` — Expected: no "No such file" errors.
- [ ] **Step 3: Commit and push**

```bash
git add -A && git commit -m "docs: CLAUDE.md, add-minigame skill and agent context"
git push -u origin feat/long-number
```
