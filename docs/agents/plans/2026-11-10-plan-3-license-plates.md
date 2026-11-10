# Plan 3 — License Plates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the License Plates minigame: realistic plates (Romania only) are shown together at different sizes, then retyped. Difficulty adapts over a 12-level table. Countries are pluggable, one file each.

**Architecture:** Follows `.claude/skills/add-minigame/SKILL.md`. Country formats live in `src/games/plates/formats/` (an interface plus `ro.ts`). Game logic (level table, round generation, scoring) is in `logic.ts`. A presentational `PlateView.vue` draws one plate in CSS, and `PlatesGame.vue` runs the round. The level persists through the stats store staircase.

**Tech Stack:** as plan 1.

**Spec:** `docs/agents/specs/2026-11-10-vue-rewrite-design.md` §6.3. Rulings: `docs/agents/questions/006` (round flow), `007` (levels, recall, generation).

## Global Constraints

- Plan 1's Global Constraints and `CLAUDE.md` apply (keys via `useGameKeys`; unmount wrappers in component tests).
- Branch `feat/plates` from `feat/number-flash`. Push when Task 4 is green.
- **Romanian rules** (cite the source in `ro.ts`: en.wikipedia.org/wiki/Vehicle_registration_plates_of_Romania):
  - 42 county codes: `B AB AG AR BC BH BN BR BT BV BZ CJ CL CS CT CV DB DJ GJ GL GR HD HR IF IL IS MH MM MS NT OT PH SB SJ SM SV TL TM TR VL VN VS`.
  - `B` has 2 digits (01–99) or 3 digits (100–999). Other counties have 2 digits (01–99). `00` is never used.
  - 3 letters A–Z without `Q`. The first letter is never `I` or `O`. The reserved groups `POL DEP SNT SRI GUV` are never generated.
  - The look: black characters on white, a blue EU band on the left with "RO", the DIN 1451-like font stack `'DIN 1451', 'D-DIN', 'Bahnschrift', var(--font-ui)`, aspect ratio 520:110.
- **Level table** (Q007), levels 1–12, staircase `{ start: 1, min: 1, max: 12, upAfter: 3, upStep: 1, downAfter: 1, downStep: 1 }`:

  | L | plates | view s | size range |
  |---|---|---|---|
  | 1 | 1 | 6 | 1–1 |
  | 2 | 1 | 4 | 1–1 |
  | 3 | 2 | 8 | 1–1 |
  | 4 | 2 | 6 | 0.75–1.25 |
  | 5 | 3 | 9 | 0.75–1.25 |
  | 6 | 3 | 7 | 0.75–1.25 |
  | 7 | 4 | 10 | 0.6–1.4 |
  | 8 | 4 | 8 | 0.6–1.4 |
  | 9 | 5 | 10 | 0.5–1.5 |
  | 10 | 5 | 8 | 0.5–1.5 |
  | 11 | 6 | 10 | 0.5–1.5 |
  | 12 | 6 | 8 | 0.5–1.5 |

  The viewing-time multiplier setting runs 0.5×–2× (step 0.25, default 1). There is no fixed-level option. Sizes come from the seeded RNG. 6 plates must fit at 400 px width.
- Recall: one input per plate, in display order. Typing is shown uppercase. Spaces, hyphens and case are ignored. A round succeeds only if **all** plates are exact. Accuracy = the mean per-plate alignment accuracy. Plates in a round are distinct, and no two consecutive plates share a county. Round flow as in Number Flash (Enter or Next; a 300 ms / no-repeat guard on the result screen).
- Tilt/perspective is a stretch goal and is **not** in this plan.

## Review Focus

1. **Generated plates are always valid** (no Q, no I/O first letter, no 00, no reserved group, B digit lengths). Pinned in Task 1 (`2000 seeded plates obey every rule`).
2. **Sloppy input** (`b-505 lsk`, extra spaces, lowercase, Romanian diacritics typed by mistake) is scored per character without crashing. Pinned in Task 2 (`normalizes input`).
3. **Enter in a plate input** moves to the next input and only submits on the last one, without skipping the result. Pinned in Task 3.
4. **6 plates at the largest size** don't overflow a 400 px screen. Pinned in Task 3 (the plate width is capped by `max-width: 100%`, asserted on the style), with a manual check by the owner.
5. **A saved level outside 1–12** is clamped (already covered by `getStaircase`), and the multiplier at 0.5× never gives a view time under 1 s. Pinned in Task 2 (`viewMs floor`).

---

### Task 1: Plate format interface + Romania

**Files:**
- Create: `src/games/plates/formats/types.ts`, `src/games/plates/formats/ro.ts`, `src/games/plates/formats/index.ts`
- Test: `src/games/plates/formats/ro.test.ts`

**Interfaces:**
- Produces:
  - `interface Plate { country: string; segments: string[]; text: string }` (`text` = segments joined by a single space, e.g. `'B 505 LSK'`)
  - `interface PlateStyle { background: string; foreground: string; bandColor: string; bandLabel: string; bandStars: boolean; aspect: number; fontFamily: string }`
  - `interface PlateFormat { id: string; name: string; generate(rng: Rng): Plate; isValid(text: string): boolean; style: PlateStyle }`
  - `ro: PlateFormat` (id `'ro'`, name `'Romania'`, aspect `520 / 110`, band `#003399` with label `RO` and stars), plus exported `RO_COUNTIES: readonly string[]` and `RO_RESERVED: readonly string[]`
  - `formats/index.ts`: `plateFormats: PlateFormat[] = [ro]` and `getPlateFormat(id: string): PlateFormat` (falls back to `ro`)
  - Plate colors are real-world constants, so they live in the format file rather than in tokens (a ruling worth recording).

- [ ] **Step 1: Write the failing tests**
  - `has the 42 counties`: `RO_COUNTIES.length === 42`, includes `'B'`, `'MM'`, `'CJ'`.
  - `2000 seeded plates obey every rule`: for `createRng(7)`, every generated `p` has `p.country === 'ro'` and `p.text === p.segments.join(' ')`. County ∈ `RO_COUNTIES`. Digits match `/^\d{2}$/` (or `/^\d{2,3}$/` when the county is `B`), and are never `00` or under `100` when 3 digits. Letters match `/^[A-PR-Z]{3}$/`, don't start with `I` or `O`, and aren't in `RO_RESERVED`. Also `ro.isValid(p.text)` is true. Across the 2000 plates, both 2- and 3-digit Bucharest plates occur.
  - `isValid rejects bad plates`: `'B 00 ABC'`, `'CJ 123 ABC'`, `'CJ 12 QAB'`, `'CJ 12 IAB'`, `'CJ 12 POL'`, `'XX 12 ABC'` → false; `'MM 123 ABC'` → false (not B); `'B 505 LSK'`, `'MM 12 ABC'` → true.
- [ ] **Step 2: Run** `npx vitest run src/games/plates` — Expected: FAIL.
- [ ] **Step 3: Implement.** Generation picks a county uniformly. For B, it picks 2 or 3 digits with equal chance. Letters are drawn from the allowed alphabet, redrawing on a reserved group.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** on the new branch: `git switch -c feat/plates`, then `git commit -m "feat(plates): pluggable plate formats with Romania"`.

---

### Task 2: Plates game logic

**Files:**
- Create: `src/games/plates/logic.ts`
- Test: `src/games/plates/logic.test.ts`

**Interfaces:**
- Consumes: Task 1, `Rng`, `alignStrings`/`AlignResult`, `StaircaseConfig`, game types.
- Produces:
  - `PLATES_ID = 'plates'`
  - `interface PlatesSettings extends GameSettings { country: string; timeMultiplier: number }`; `PLATES_DEFAULTS = { country: 'ro', timeMultiplier: 1 }`; `PLATES_FIELDS` (country select built from `plateFormats`; timeMultiplier 0.5–2 step 0.25 unit `×`, label "Viewing time")
  - `interface PlateLevel { plates: number; viewSeconds: number; minScale: number; maxScale: number }`; `PLATE_LEVELS: readonly PlateLevel[]` (index 0 = level 1, exactly the table above)
  - `PLATES_STAIRCASE: StaircaseConfig`
  - `levelInfo(level: number): PlateLevel` (clamped to 1–12)
  - `viewMs(level: number, multiplier: number): number` = `max(1000, round(viewSeconds·1000·multiplier))`
  - `interface PlateRound { plates: Plate[]; scales: number[] }`; `generateRound(rng: Rng, level: number, format: PlateFormat): PlateRound` (distinct texts, no consecutive equal county, scales uniform in [min, max] rounded to 2 decimals)
  - `normalizePlateInput(input: string): string` (NFC, uppercase, remove whitespace and `-`)
  - `interface PlatesScore { perPlate: AlignResult[]; accuracy: number; success: boolean }`; `scorePlates(plates: Plate[], answers: string[]): PlatesScore` (compare `normalizePlateInput(answer)` with the plate's segments joined without spaces)
  - `summarizePlates(rounds: RoundRecord[]): GameSummary`: headline `best level <n>` (max `level` over successful rounds), `'no perfect round yet'`, or `'not played'`. Stats: `Rounds`, `Best level`, `Most plates at once` (max `metrics.plates` over successes, or `—`), `Success (last 20)`.

- [ ] **Step 1: Write the failing tests**
  - `level table matches the ruling`: `PLATE_LEVELS.length === 12`, `PLATE_LEVELS[0]` equals `{ plates: 1, viewSeconds: 6, minScale: 1, maxScale: 1 }`, `PLATE_LEVELS[11]` equals `{ plates: 6, viewSeconds: 8, minScale: 0.5, maxScale: 1.5 }`.
  - `difficulty never decreases`: for each consecutive pair, plates never go down. When plates are equal, viewSeconds strictly decreases. The scale spread (`max − min`) never goes down. Seconds per plate never go up.
  - `viewMs floor`: `viewMs(1, 1) === 6000`, `viewMs(2, 0.5) === 2000`, `viewMs(12, 2) === 16000`, `viewMs(99, 1) === 8000`, and `viewMs(2, 0.1) === 1000` (the floor).
  - `generateRound`: at level 12 with `createRng(3)`, 6 distinct plates, no consecutive equal county, all scales in [0.5, 1.5]. At level 1 the scale is exactly `[1]`.
  - `normalizes input`: `normalizePlateInput(' b-505 lsk ') === 'B505LSK'`. `scorePlates([B 505 LSK], ['b 505 lsk']).success === true`. `scorePlates([B 505 LSK, MM 12 ABC], ['B505LSK', 'MM12ABD'])` → success false, accuracy ≈ `(1 + 6/7) / 2`. A missing answer (`[]`) counts as empty, and a diacritic (`'B 505 LȘK'`) is a substitution, not a crash.
  - `summary`: three records (a level 3 success with `metrics.plates` 2, a level 5 success with 3, a level 6 failure with 3) → headline `best level 5`, `Most plates at once` `3`. Empty → `not played`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(plates): level table, round generation and scoring"`

---

### Task 3: Plate view and game screen

**Files:**
- Create: `src/games/plates/PlateView.vue`, `src/games/plates/PlatesGame.vue`
- Modify: `src/components/RecallInput.vue` (add the prop `autofocus?: boolean`, default `true`, and `defineExpose({ focus })`)
- Test: `src/games/plates/PlatesGame.test.ts`, plus an `autofocus` case in `src/components/components.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2, `useCountdown`, `useGameKeys`, `useStatsStore` (`getStaircase` / `saveStaircase`), `stepStaircase`, `TimerBar`, `RecallInput`, `ResultDiff`.
- Produces:
  - `PlateView` props `{ plate: Plate; format: PlateFormat; scale?: number }`. The root has class `plate`, the style `width: calc(var(--plate-base-width) * scale)`, and `max-width: 100%`. The band shows stars (a simple ring of 12 small dots in SVG) above the label. The segments are spaced as on real plates. `--plate-base-width: 15rem` is defined in the component's CSS.
  - `PlatesGame` props `{ settings: PlatesSettings; rng?: Rng }`. It emits `round-complete` (`level` = the played level, `metrics: { plates, correct: platesExactCount }`, `success`, `accuracy`, `durationMs`) and `level` (on mount, and after each round).

Phases: `ready` ("Level N · P plates · Ts"; Start) → `show` (`TimerBar` plus the plates in a wrapping, centered flex grid; Esc or Skip calls `finishNow` with preventDefault) → `recall` (one `RecallInput` per plate with `inputmode="text"`, label `Plate i`, `autofocus` only on the first. Enter in input i focuses input i+1. On the last input Enter submits, and a Check button also submits) → `result` (for each plate: a small `PlateView` plus a `ResultDiff`; "Level 3 → 4" or "Level 3 (streak 1/3)"; Next with the 300 ms / no-repeat Enter guard).

- [ ] **Step 1: Write the failing tests** (mocked storage, fresh Pinia, fake timers incl. `performance` and rAF, seeded `rng`, wrappers unmounted in `afterEach`; the expected plates come from `generateRound(createRng(1), level, ro)`)
  - `plays a level-1 round`: `level` 1 emitted on mount. Start → one `.plate` showing the expected text. After 6050 ms there is 1 input. Type the plate in lowercase plus Enter → `.diff-match` count equals its character count, and `round-complete` matches `{ success: true, level: 1, metrics: { plates: 1, correct: 1 } }`.
  - `Enter moves between plate inputs`: save the level as 3 (2 plates). After the reveal, typing in input 1 plus Enter focuses input 2 (`document.activeElement`) with no `round-complete` yet. Enter in input 2 → `round-complete` is emitted.
  - `one wrong plate fails the round and levels down`: at level 3, answer plate 1 correctly and plate 2 wrongly → `success: false`, `metrics.correct === 1`, and `level` 2 emitted.
  - `plates are capped to the screen width`: at level 12, every `.plate` element's inline style contains `max-width: 100%` (or the class rule does, via `getComputedStyle`).
  - `RecallInput autofocus=false does not take focus` (in `components.test.ts`).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(plates): plate view and game screen"`

---

### Task 4: Register, country skill, push

**Files:**
- Create: `src/games/plates/index.ts` (`plates: GameModule<PlatesSettings>`: id `plates`, name `License Plates`, tagline `Memorize the plates, then type them back.`, trains `Encoding mixed letter/digit chunks at a glance`)
- Create: `.claude/skills/add-plate-country/SKILL.md`: how to add a country: create `formats/<id>.ts` implementing `PlateFormat` with a cited source; add a rules test modeled on `ro.test.ts` (2000 seeded plates plus isValid cases); add it to `plateFormats`; check `PlateView` handles its band and colors; then run the full checks.
- Modify: `src/games/registry.ts` (append `plates`), `src/games/registry.test.ts` (the expected ids gain `'plates'`), `README.md` (tick License Plates), `CLAUDE.md` (mention the second skill)

- [ ] **Step 1: Update the registry test** to expect `['long-number', 'number-flash', 'plates']`; run it and watch it fail.
- [ ] **Step 2: Implement** `index.ts`, the registry entry and the skill; run it and watch it pass.
- [ ] **Step 3: Full checks** `npx vitest run && npm run type-check && npm run lint && npm run build && npm run format` — Expected: all green.
- [ ] **Step 4: Commit and push** `git commit -m "feat(plates): register game and add-plate-country skill"` and `git push -u origin feat/plates`.
