# Plan 5 — Card Match Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Card Match, the classic pairs game, with an optional preview. It is scored against the fewest possible moves, and it counts "memory mistakes" separately from bad luck.

**Architecture:** Follows the add-minigame skill. A pure board state machine (`flip`) in `logic.ts` decides matches, mismatches and memory mistakes. `CardSymbol.vue` draws 18 original SVG shapes. `CardGrid.vue` handles layout and roving-tabindex keyboard navigation, and `CardMatchGame.vue` runs the round. A new core composable, `useActiveTime`, measures play time while excluding hidden-tab time.

**Spec:** §6.5. Rulings: `docs/agents/questions/006` (round flow) and `009` (all rules below).

## Global Constraints

- Plan 1's Global Constraints and `CLAUDE.md` apply. Branch `feat/card-match` from `feat/maze`; push when Task 4 is green. Lint before each commit.
- **Levels** (staircase `{ start: 1, min: 1, max: 6, upAfter: 3, upStep: 1, downAfter: 1, downStep: 1 }`): 1: 2×3 · 2: 3×4 · 3: 4×4 · 4: 4×5 · 5: 4×6 · 6: 6×6 (rows × cols; pairs = rows·cols/2).
- **Preview:** setting `previewSecondsPerPair` 0–3 (step 0.25, **default 0.5**). Preview time = pairs × setting; 0 = no preview. Timed with `useCountdown`; Esc or Skip ends it early.
- **Move:** two flips. **Memory mistake** (at most 1 per mismatched move, with first card A and second card B, where "seen" is evaluated before this move's reveals): count it if `(seen[partner(A)] && B !== partner(A)) || (seen[B] && B !== partner(A))`. "Seen" means face-up at any earlier moment (the preview counts). Matched cards are out of play.
- **Success** = zero memory mistakes. `accuracy = pairs / moves`. `metrics: { pairs, rows, cols, moves, extraMoves, memoryMistakes, preview: 0|1 }`. `durationMs` = active play time excluding a hidden tab.
- **Flip-back:** a mismatched pair stays face-up for **700 ms** (`useCountdown`). A click during that window first flips both back, then is handled normally. Matched pairs stay face-up and dimmed.
- **Symbols:** 18 original inline-SVG shapes, **distinguishable by shape alone**. Colours come from a `--sym-1…--sym-6` palette added to `tokens.css`. Each card has an aria-label (face-down: "Card 5, hidden"; face-up: "Card 5, star").
- **Keyboard:** cards are native `<button>`s with a roving tabindex (one tabbable card), and the arrow keys move focus within the grid. Activation is the browser's native Enter/Space; `useGameKeys` does NOT handle Enter during play. Esc during play falls through to the shell (quit).
- **Layout:** cards are square-ish buttons in a CSS grid with `cols` columns. On narrow screens (`max-width: 30rem`) where cols > rows, rows and cols swap visually: `columns = rows`, and arrow navigation uses the rendered column count. The grid fits `min(100%, 32rem)`.

## Review Focus

1. **Memory-mistake counting** matches the definition in every case (a known partner skipped, a known non-partner flipped, the preview counting as seen, a lucky first sight not counted). Pinned in Task 1 (table-driven tests).
2. **Fast clicking during the 700 ms flip-back** never lets three cards be face-up or loses a click. Pinned in Task 1 (`flip during pending`) and Task 3.
3. **Clicking a matched card or the same card twice** is ignored and isn't a move. Pinned in Task 1.
4. **Keyboard-only play** (Tab into the grid, arrows, Enter/Space) works and doesn't double-fire. Pinned in Task 2 and Task 3.
5. **Hidden-tab time** is excluded from `durationMs`. Pinned in Task 1 (`useActiveTime`).

---

### Task 1: Board logic, levels, active time

**Files:** Create `src/games/card-match/logic.ts` and `src/core/timing/useActiveTime.ts`. Tests: `src/games/card-match/logic.test.ts` and `src/core/timing/useActiveTime.test.ts`.

**Interfaces (Produces):**
- `CARD_MATCH_ID = 'card-match'`; `SYMBOL_COUNT = 18`
- `interface CardMatchSettings extends GameSettings { previewSecondsPerPair: number }`; `CARD_MATCH_DEFAULTS = { previewSecondsPerPair: 0.5 }`; `CARD_MATCH_FIELDS` (label "Preview per pair", unit `s`, help "0 = no preview")
- `interface CardLevel { rows: number; cols: number }`; `CARD_LEVELS`; `CARD_STAIRCASE`; `cardLevelInfo(level)` (clamped); `pairsOf(l: CardLevel)`; `previewMs(level, secondsPerPair)`
- `dealCards(rng: Rng, pairs: number): number[]` (symbol ids 0–17, each chosen symbol exactly twice, a random subset, shuffled)
- `interface Board { cards: number[]; matched: boolean[]; seen: boolean[]; first: number | null; pending: [number, number] | null; moves: number; memoryMistakes: number }`
- `createBoard(cards: number[], previewed: boolean): Board`
- `type FlipEvent = 'first' | 'match' | 'mismatch' | 'ignored'`
- `flip(board: Board, index: number): { board: Board; event: FlipEvent; mistake: boolean }` (pure. If `pending` is set, clear it first, then handle the click)
- `clearPending(board: Board): Board`; `isComplete(board: Board): boolean`; `faceUp(board: Board, i: number): boolean` (matched, or first, or in pending)
- `summarizeCardMatch(rounds)`: headline `largest R×C` (over successful rounds, by pairs), `'no perfect round yet'`, or `'not played'`. Stats: `Rounds`, `Largest cleared`, `Extra moves (avg, last 10)` (one decimal), `Perfect rounds (last 20)` (%).
- `useActiveTime(opts?: { clock?: Clock }): { start(): void; stop(): number; elapsed(): number }` (pauses while `document.visibilityState === 'hidden'`)

- [ ] **Step 1: Write the failing tests**
  - levels and staircase values; `previewMs(1, 0.5) === 1500`, `previewMs(6, 0.5) === 9000`, `previewMs(3, 0) === 0`.
  - `dealCards(createRng(2), 8)`: length 16, each value appears exactly twice, all in 0–17; level 6 uses 18 distinct symbols.
  - Board on `cards = [0, 1, 0, 1]` (partners 0↔2, 1↔3), no preview:
    - flip 0 gives `first`; flip 2 gives `match` (moves 1, no mistake).
    - **lucky first sight:** flip 0, flip 1 → `mismatch`, mistake false (nothing seen before).
    - **known partner skipped:** flip 0, flip 1 (mismatch, both now seen), flip 3 (first), flip 0 (first was 3, whose partner 1 was seen, and 0 ≠ 1) → mistake true.
    - **known non-partner flipped:** flip 0, flip 1, then flip 2 (first; its partner 0 is seen) → flip 1 (seen, not a partner) → mistake true (counted once).
    - **preview counts as seen:** `createBoard(cards, true)`, flip 0, flip 1 → mistake true.
  - `flip during pending`: after a mismatch, the board has `pending` set; flipping a third card clears pending (both face-down) and makes the third card `first`. `faceUp` is true for exactly one card.
  - `ignored`: flipping a matched card, or the current `first` again, gives `ignored`, with no change to moves.
  - `isComplete` is true after all pairs match.
  - summary on three records (2×3 perfect, 4×4 perfect, 4×5 failure) → headline `largest 4×4`.
  - `useActiveTime` with a fake clock and mocked visibility: start at 0, hidden at 1000, visible at 5000, stop at 6000 → 2000.
- [ ] **Step 2–4:** RED → implement → GREEN.
- [ ] **Step 5: Commit** (create `feat/card-match` first) `feat(card-match): board logic, levels and active time`.

---

### Task 2: Symbols and grid

**Files:** Create `src/games/card-match/CardSymbol.vue` and `src/games/card-match/CardGrid.vue`. Modify `src/styles/tokens.css` (add `--sym-1…--sym-6`). Test `src/games/card-match/components.test.ts`.

**Interfaces (Produces):**
- `CardSymbol` props `{ id: number }`. Renders `<svg class="symbol" :data-symbol="id">` with the shape for `id % 18` and colour `var(--sym-${(id % 6) + 1})`. It exports `SYMBOL_NAMES: readonly string[]` (18 names, used in the aria-labels).
- `CardGrid` props `{ cards: number[]; faceUp: boolean[]; matched: boolean[]; rows: number; cols: number; disabled?: boolean }`; emits `flip(index)`. It renders `button.card` × n with the classes `up` and `matched`, an aria-label, `tabindex` 0 on the roving card and −1 elsewhere, and ArrowUp/Down/Left/Right moving focus by the rendered column count (clamped at the edges). Clicking a face-up or matched card still emits `flip` (the board ignores it).

- [ ] **Step 1: Write the failing tests:** CardSymbol renders 18 distinct shapes (the set of `innerHTML` strings for ids 0–17 has size 18). `SYMBOL_NAMES` has 18 unique names. CardGrid: 6 buttons for a 2×3 grid, exactly one with `tabindex="0"`; ArrowRight moves focus from 0 to 1 and ArrowDown from 0 to 3; clicking button 4 emits `flip` with `[4]`; Enter on a button is left to the browser (no `flip` from the keydown itself, so there's no double fire); aria-labels read `Card 1, hidden` and, when face-up, `Card 1, <name>`.
- [ ] **Step 2–4:** RED → implement → GREEN. **Step 5: Commit** `feat(card-match): symbols and keyboard-navigable grid`.

---

### Task 3: Card Match game screen

**Files:** Create `src/games/card-match/CardMatchGame.vue`. Test `src/games/card-match/CardMatchGame.test.ts`.

**Interfaces:** props `{ settings: CardMatchSettings; rng?: Rng }`; emits `round-complete` and `level`. The phases are `ready` ("Level N · R×C · preview Ts" or "no preview"; Start) → `preview` (all face-up plus `TimerBar`; Esc or Skip ends it; skipped when the preview time is 0) → `play` (`CardGrid`; the "Moves m · minimum p" counter; a mismatch starts a 700 ms `useCountdown`, then `clearPending`) → `result` ("Cleared in m moves (minimum p)", "Memory mistakes: k", the verdict (perfect or not), the level change line, Next with the 300 ms guard).

- [ ] **Step 1: Write the failing tests** (mocked storage, Pinia, fake timers, seeded rng; the expected cards come from `dealCards(createRng(1), 3)`; unmount in afterEach):
  - `perfect round with preview`: Start → all cards face-up (`.card.up` × 6) → advance 1550 ms → all face-down → click the pairs in order → `round-complete` `{ success: true, level: 1, metrics: { moves: 3, memoryMistakes: 0, extraMoves: 0, preview: 1 } }`, and the text contains `minimum 3`.
  - `no preview: a lucky mismatch is no mistake`: settings `previewSecondsPerPair: 0` → Start goes straight to play. Click two non-matching cards, then advance 750 ms → both face-down again → finish by clicking pairs → `memoryMistakes` 0, `success: true`.
  - `fast third click during flip-back`: after a mismatch, immediately click a third card → never more than 2 `.card.up` (unmatched), and the third card is face-up.
  - `a memory mistake fails the round and keeps level 1`: with the preview, mismatch once, then finish → `success: false`, `level` emitted 1 (already at min).
  - `keyboard play`: focus the first card and press ArrowRight → focus moves; a `click()` on the focused button flips it (native activation path).
  - `Esc during preview skips (prevented)`; `Esc during play is not prevented` (the shell would quit).
- [ ] **Step 2–4:** RED → implement → GREEN. **Step 5: Commit** `feat(card-match): playable game screen`.

---

### Task 4: Register and push

- [ ] The registry test expects `[..., 'maze', 'card-match']`; RED.
- [ ] `src/games/card-match/index.ts` (`cardMatch`: name `Card Match`, tagline `Find every pair in as few moves as possible.`, trains `Spatial location memory`); registry entry; tick the README; GREEN.
- [ ] Full checks + format; commit `feat(card-match): register game`; `git push -u origin feat/card-match`.
