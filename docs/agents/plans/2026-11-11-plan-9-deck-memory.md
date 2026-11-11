# Plan 9 — Deck Memory (playing cards) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new minigame the owner asked for, outside the spec. The player memorizes the order of shuffled playing cards (the memory-sport "Speed Cards" discipline), then rebuilds it with a card picker or typed codes.

**Architecture:** Follows the add-minigame skill. A core refactor adds `alignSequences<T>`, with `alignStrings` becoming a wrapper and no behaviour change. In `src/games/deck-memory/`: `cards.ts` (ids, codes, parsing), `logic.ts` (settings, levels, dealing, scoring, summary), `PlayingCard.vue` and `CardPicker.vue`, `DeckMemoryGame.vue`, and `index.ts`.

**Spec:** the spirit of the spec (precise, fair, readable). Ruling: `docs/agents/questions/012` (binding), plus 001, 004, 006 and 009.

## Global Constraints

- Plan 1's constraints and `CLAUDE.md` apply. Branch `feat/deck-memory` from `feat/stats`; push when Task 5 is green. Lint before each commit.
- **Cards:** ids 0–51 → `suit = Math.floor(id / 13)` in the order ♠ S, ♥ H, ♦ D, ♣ C; `rank = id % 13` in the order A 2 3 4 5 6 7 8 9 10 J Q K. The code is rank + suit letter (`AS`, `10H`, `QD`). The name reads like "Queen of diamonds". Codes are parsed case-insensitively, with ranks `A 2–10 T J Q K` and suits `S H D C ♠ ♥ ♦ ♣`.
- **Look:** a light card face (token `--card-face`), with ink from `--suit-red` (hearts/diamonds) and `--suit-black`. The rank and suit symbol are always shown, and each card has an aria-label.
- **Levels:** `[4, 6, 8, 10, 13, 16, 20, 26, 39, 52]`, staircase `{ start: 1, min: 1, max: 10, upAfter: 3, upStep: 1, downAfter: 1, downStep: 1 }`.
- **Settings:** `secondsPerCard` 1–20, step 0.5, default **5**; `view` `'one' | 'row'`, default **`one`**. Settings are snapshotted per round.
- **Memorize:** limit = cards × secondsPerCard (`useCountdown`). **Done**, Enter or Esc ends it (Esc is preventDefault-ed). `memoMs` = visible elapsed time via `useActiveTime`. In `one` view: a position label "i / N", ← → keys and ‹ › buttons. In `row` view: all cards wrap.
- **Recall:** `answer: number[]` is the single source of truth. Picker taps append; used cards are disabled. **Undo** removes the last card (also Backspace outside inputs); **Clear** empties the answer. The text box parses on Enter, appends the valid tokens, and keeps the bad ones in the box with an inline error ("invalid" / "already used"). Enter in an **empty** box = Check. Check with fewer cards is allowed.
- **Scoring:** `alignSequences(expected, answer)`. Success = exact order. `metrics: { cards, correct, memoMs }`. Round flow as in Number Flash (Next/Enter, 300 ms guard).
- **Summary:** headline `best <n> cards` / `no perfect round yet` / `not played`. Stats: `Rounds`, `Largest perfect`, `Fastest memorization (largest)` (`m:ss`, or `—`), `Success (last 20)`.

## Review Focus
1. **The `alignStrings` behaviour is unchanged** (all existing tests pass unmodified). Pinned in Task 1.
2. **Sloppy typed codes** (`ts`, `10♥`, `qd`, `1x`, a duplicate) parse or report inline, never crash. Pinned in Task 2.
3. **A duplicate card** can't enter the answer from either the picker or the text box. Pinned in Task 2 (parse with `used`) and Task 4.
4. **Hidden-tab time** is excluded from `memoMs`. Pinned in Task 4.
5. **52 cards in `row` view at 400 px** wrap without overflow. The width is capped via CSS (`flex-wrap`, card width in `rem`); the owner checks manually.

---

### Task 1: `alignSequences` (core refactor)
**Files:** modify `src/core/scoring/align.ts`; add tests to `align.test.ts` (existing tests unchanged).
**Produces:** `type SeqOp<T> = { kind: 'match'; item: T } | { kind: 'substitute'; expected: T; actual: T } | { kind: 'missing'; expected: T } | { kind: 'extra'; actual: T }`; `interface SeqResult<T> { ops: SeqOp<T>[]; correct; expectedLength; accuracy; exact }`; `alignSequences<T>(expected: readonly T[], actual: readonly T[], equals?: (a: T, b: T) => boolean): SeqResult<T>`. `alignStrings` maps `item` → `char`.
- [ ] RED: number tests (`[1,2,3,4,5]` vs `[1,2,4,5]` → missing 3, accuracy 0.8; an extra; a substitute; empty arrays; a custom `equals`).
- [ ] GREEN (and existing align tests unchanged), then commit `refactor(core): generic alignSequences`.

### Task 2: Cards and game logic
**Files:** `src/games/deck-memory/cards.ts`, `logic.ts` (+ tests).
**Produces (cards.ts):** `CARD_COUNT = 52`; `SUITS` (letter, symbol, name, red); `RANKS` (label, name); `cardSuit(id)`, `cardRank(id)`, `cardCode(id)`, `cardName(id)`, `isRed(id)`; `parseCode(token): number | null`; `parseCodes(text, used: ReadonlySet<number>): { ids: number[]; problems: { token: string; reason: 'invalid' | 'used' }[] }` (also rejects duplicates within the text).
**Produces (logic.ts):** `DECK_MEMORY_ID = 'deck-memory'`; settings, defaults and fields; `DECK_LEVELS`; `DECK_STAIRCASE`; `deckLevelCards(level)`; `dealSequence(rng, n): number[]`; `scoreDeck(expected, answer): SeqResult<number>`; `summarizeDeckMemory(rounds)`.
- [ ] RED: codes round-trip for all 52; `parseCode('ts') === parseCode('10S')`; `10♥`, `qd` and `Qd` parse; `1x` and `''` → null; `parseCodes('AS 2h zz AS', new Set([cardOf('2H')]))` → ids `[AS]`, problems zz invalid, 2h used, and the second AS used. Levels strictly increase, and the defaults sanitize to themselves. `dealSequence` gives distinct ids, the requested length, and is seeded. The summary covers headline, fastest and empty.
- [ ] GREEN, then commit `feat(deck-memory): cards, codes and game logic`.

### Task 3: PlayingCard and CardPicker
**Files:** `PlayingCard.vue` (props `{ id: number; size?: 'sm' | 'md' | 'lg' }`, with class `red`/`black` and an aria-label), `CardPicker.vue` (props `{ used: number[] }`, emits `pick(id)`; 4 rows × 13 buttons `.pick` with `disabled` when used; a roving tabindex with arrows over 13 columns). Add the tokens `--card-face`, `--suit-red`, `--suit-black`. Test `components.test.ts`.
- [ ] RED: PlayingCard shows `Q` and `♦`, class red, aria-label `Queen of diamonds`. The picker has 52 buttons, used ones disabled; a click emits pick; ArrowRight/ArrowDown move focus by 1 / 13.
- [ ] GREEN, then commit `feat(deck-memory): playing card and picker`.

### Task 4: Game screen
**Files:** `DeckMemoryGame.vue` (+ test).
- [ ] RED (mocked storage, fake timers incl. performance/rAF, seeded rng, unmount in afterEach; the expected cards come from `dealSequence(createRng(1), 4)`):
  - In `one` view, Start shows "1 / 4" and one card; → moves to "2 / 4"; Done ends memorize; picking the 4 cards in order then Check → `round-complete` `{ success: true, level: 1, metrics: { cards: 4, correct: 4 } }`.
  - Typing the codes in the text box + Enter appends them; Enter in the empty box checks.
  - A duplicate pick is impossible (the button is disabled after use); Undo and Backspace remove the last card.
  - Hidden tab: hiding for 10 s during memorize doesn't add to `memoMs` (`memoMs` < 2000 with 1 s visible).
  - `row` view shows 4 cards at once.
  - Esc during memorize ends it and is prevented; the Next guard holds (Enter at +100 ms is ignored).
  - One wrong card → success false, and the result shows a substitute.
- [ ] GREEN, then commit `feat(deck-memory): playable game screen`.

### Task 5: Register, docs, push
- [ ] Registry test expects `[..., 'card-match', 'deck-memory']` (RED → GREEN with `index.ts`: name `Deck Memory`, tagline `Memorize the order of shuffled playing cards, then rebuild it.`, trains `Memorizing card sequences — the memory-sport classic (PAO + memory palace)`).
- [ ] README roadmap line; `decisions/log.md` (the owner's instruction for an out-of-spec module, and alignSequences); `memory-theory.md` (a PAO / Speed Cards section plus a module table row). Then full checks, commit and push `feat/deck-memory`.
