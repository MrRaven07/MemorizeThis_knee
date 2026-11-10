# Plan 6 — Major System Flashcards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a flashcard trainer for the player's own `input → output` decks (e.g. Major System `00 → sos`). It covers CSV/JSON/paste import with a preview, export, three study modes (smart, shuffle, pick), reverse direction, and per-deck stats.

**Architecture:** Pure logic lives in `src/features/major/` (parsing, export, import planning, range selection, scheduler, stats). There is one Pinia store, `src/stores/decks.ts`, persisted under `mt:decks`. The views are `MajorView` (deck list), `DeckView` (cards, import/export, stats, study setup) and `StudyView` (the flip cards). It is **not** a GameModule; it has its own routes `/major…` and a Home tile.

**Spec:** §6.6, §7, §8. Ruling: `docs/agents/questions/010` (binding details below).

## Global Constraints

- Plan 1's constraints and `CLAUDE.md` apply. Branch `feat/major` from `feat/card-match`; push when Task 7 is green. Lint before each commit.
- **Data:** `Card { id: string /* randomUUID */; input: string; output: string }`. `CardProgress { box: 1|2|3|4|5; knew: number; missed: number; lastAnsweredAt: number | null }`. `Deck { id; name; createdAt; cards: Card[]; progress: { forward: Record<cardId, CardProgress>; reverse: Record<cardId, CardProgress> } }`. Stored as `Deck[]` under `mt:decks` and saved after every change. Loading is shape-guarded (an invalid value → `[]` with the raw text kept under `.corrupt`). Text is trimmed and NFC-normalized on input. Inputs are compared case-sensitively.
- **Progress is keyed by card id.** Editing a card or replacing it on import keeps its progress. New cards start in box 1.
- **Import:** CSV, JSON or paste. Always a **preview** first (N new, M changed, unchanged count, errors). **Any error blocks the import**, and every error is listed with a 1-based line number counting every original line. Conflicts: **Replace existing / Keep existing / Cancel**.
  - CSV: RFC 4180 quoting. The delimiter is whichever of `,` and `;` splits the first data line into exactly 2 fields outside quotes; if both or neither do, it's an error. The header is skipped when the first row is `input,output` / `input;output` (case-insensitive). Every row must have exactly 2 non-empty fields. A UTF-8 BOM is stripped. Blank lines are skipped.
  - JSON: an array of `{ input: string, output: string }`. Numbers and other types are errors (never coerced). The line number for JSON errors is the 1-based array index, reported as "item N".
  - Paste: one pair per line. The separator is the first one present in the order **tab > ` - ` > `;` > `,`**, split at its **first** occurrence.
  - A duplicate input within one file is an error (with both line numbers).
- **Export:** CSV (`,`, header `input,output`, quoted when needed, **UTF-8 BOM**) and JSON (pretty-printed, 2-space indent). No progress included. Download via Blob, as Backup does.
- **Scheduler (smart mode):** a session tick counts cards shown, with `INTERVALS = [1, 3, 9, 27, 81]` for boxes 1–5. `overdue = (tick − lastSeenTick + 1) / INTERVALS[box−1]`. A card not yet seen this session has `lastSeenTick = −INTERVALS[box−1]`. Pick the highest score, ties by lower box, then deck order. **A missed card is forced back after exactly 3 other cards** (or at the end when fewer than 3 others exist), and this overrides the score. Knew → box +1 (max 5); missed → box 1. The session is endless. The counter shows "this session: n · knew k · missed m".
- **Shuffle mode:** every selected card once, in an order from `createRng`; then a summary; then **Again** reshuffles. Box updates apply.
- **Pick mode:** a checklist with Select all / none, plus a **range box**. Items are separated by `,`. A range `a-b` whose ends are digit strings of the **same length** matches only digit inputs of that length numerically in [a, b]. Ends of **different length** match digit inputs of any length numerically. A single item matches an input exactly. Invalid items and items that match nothing are shown inline. The picked subset is then studied in smart or shuffle order.
- **Reverse:** a toggle per study session (show output, recall input), with progress tracked per direction.
- **Study UI:** show the prompt → **Flip** (Space/Enter) → show the answer → **Knew it** (→ or `k`) / **Didn't** (← or `d`). Nothing is typed. All keys go through `useGameKeys` (buttons keep their own Enter/Space).
- **Stats per deck and direction:** known well = box ≥ 4; success = knew / (knew + missed) over all cards (`—` when there are no answers); **weakest** = up to 10 cards with ≥ 3 answers and the lowest success, ties broken by more misses.
- **Session time:** `beginActivity('major')` only while `StudyView` is mounted. Answers don't call `noteRound`. Answers are counted in the decks store's session tally (`answeredThisSession`), which plan 7 will use.
- Routes: `/major` (`major`), `/major/:deckId` (`deck`; unknown → `/major`), `/major/:deckId/study` (`study`, with query `mode=smart|shuffle` and `dir=forward|reverse`). The pick selection is passed through the store (`studySelection: string[] | null`, not persisted). The Home grid gets a **Major System** tile (same style, headline `N decks · K cards` or `no decks yet`).

## Review Focus

1. **Diacritics and commas survive** a round trip (export, then import, back to the same deck). Pinned in Task 1.
2. **Malformed files never write partial data** (a bad row in the middle, a JSON number, a duplicate input). Pinned in Task 1 (parsers) and Task 4 (the store refuses to apply a plan with errors).
3. **No card starves in smart mode**, and a missed card returns after exactly 3 others. Pinned in Task 3.
4. **Editing a card keeps its progress**, and so does replacing it via import. Pinned in Task 2 and Task 4.
5. **Range `0-9` doesn't select `00`–`09`**; unmatched or invalid items are reported. Pinned in Task 2.

---

### Task 1: Parsing and export

**Files:** `src/features/major/types.ts`, `src/features/major/parse.ts`, `src/features/major/export.ts`. Test: `src/features/major/parse.test.ts`.

**Produces:** the types above, plus `interface ParsedPair { input: string; output: string; line: number }` and `interface ParseError { line: number; message: string }` (for JSON, `line` = item index, with a message starting "item N:"); `interface ParseResult { pairs: ParsedPair[]; errors: ParseError[] }`; `parseCsv(text): ParseResult`; `parseJson(text): ParseResult`; `parsePaste(text): ParseResult`; `parseAuto(text, filename?: string): ParseResult` (`.json` or leading `[` → JSON; `.csv` → CSV; otherwise paste); `toCsv(cards: Pick<Card,'input'|'output'>[]): string` (with BOM); `toJson(cards): string`.

- [ ] **Step 1: Failing tests**
  - CSV: `'input,output\n00,sos\n01,"sat, mare"\n'` → 2 pairs (`01` → `sat, mare`), on lines 2–3. `';'` delimiter works. A BOM is stripped. The header is detected case-insensitively. A row with 3 fields → an error on its line. An empty output → an error. A duplicate `00` → an error naming both lines. Blank lines are skipped, but line numbers still count them.
  - The ambiguous delimiter `a,b;c` → an error.
  - JSON: valid → pairs; `[{"input":0,"output":"sos"}]` → an error with message `item 1: …` (not coerced); not an array → an error; invalid JSON → an error.
  - Paste: `00 - sos` → `00`/`sos`; `03\tzeamă` → tab wins; `a - b - c` → input `a`, output `b - c`; `x;y,z` → `;` wins over `,`; a line with no separator → an error on that line.
  - NFC: an input given as decomposed `ș` equals composed `ș` after parsing.
  - **Round trip:** `toCsv([{input:'01',output:'sat, mare'},{input:'05',output:'solz "ș"'}])` starts with `﻿`, and `parseCsv` of it returns the same 2 pairs. The same for `toJson`/`parseJson`.
- [ ] **Step 2–4:** RED → implement → GREEN. **Step 5:** `git switch -c feat/major`; commit `feat(major): import parsers and export`.

---

### Task 2: Deck operations, import planning, range selection, stats

**Files:** `src/features/major/deck.ts`, `src/features/major/selection.ts`, `src/features/major/stats.ts`. Tests: `deck.test.ts`, `selection.test.ts`, `stats.test.ts`.

**Produces:**
- `createDeckData(name: string, now: number): Deck`; `addCard(deck, input, output): Deck`; `updateCard(deck, id, input, output): Deck` (keeps id and progress); `removeCard(deck, id): Deck` (also removes its progress); `progressOf(deck, dir: Direction, id): CardProgress` (default box 1). `type Direction = 'forward' | 'reverse'`.
- `interface ImportPlan { added: { input: string; output: string }[]; changed: { id: string; input: string; from: string; to: string }[]; unchanged: number; errors: ParseError[] }`; `planImport(deck, parsed: ParseResult): ImportPlan`; `applyImport(deck, plan, mode: 'replace' | 'keep'): Deck` (throws if `plan.errors.length > 0`; replace updates the output in place and keeps the id/progress; keep leaves existing cards alone; added cards get new ids).
- `parseSelection(text: string, cards: Card[]): { ids: string[]; problems: { item: string; reason: 'invalid' | 'no match' }[] }`.
- `deckStats(deck, dir): { total: number; knownWell: number; successRate: number | null; weakest: { card: Card; rate: number; answers: number }[] }`.

- [ ] **Step 1: Failing tests**
  - `updateCard` keeps `id` and `progress.forward[id]`; `removeCard` drops the progress.
  - `planImport` on a deck with `00→sos`, importing `00→sos, 01→sat, 00?`: a changed output `00→soș` is listed in `changed` with from/to; identical lines count as `unchanged`; new lines go to `added`. `applyImport(…, 'replace')` updates `00` with the same id; `'keep'` doesn't. With errors, `applyImport` throws.
  - Selection over inputs `0`–`9` and `00`–`99`: `0-9` → exactly the 10 single-digit cards; `00-09` → exactly 10 two-digit cards; `5-12` → `5`–`9` and `10`–`12` (any length, numerically); `15, 77` → those two; `30-2x` → a problem `invalid`; `500` → a problem `no match`; duplicates are removed and deck order is kept.
  - Stats: with progress set by hand (box 4/5 → known; rates), weakest skips cards with < 3 answers, sorts by rate ascending then misses descending, and is capped at 10. With no answers, `successRate` is null.
- [ ] **Step 2–4:** RED → implement → GREEN. **Step 5:** commit `feat(major): deck ops, import planning, range selection, stats`.

---

### Task 3: Scheduler

**Files:** `src/features/major/scheduler.ts`. Test: `scheduler.test.ts`.

**Produces:** `INTERVALS = [1, 3, 9, 27, 81] as const`; `interface SmartSession { tick: number; lastSeen: Record<string, number>; forced: { id: string; dueTick: number }[] }`; `createSmartSession(): SmartSession`; `nextSmart(session, ids: string[], boxOf: (id) => number): string`; `recordSmart(session, id: string, knew: boolean, idsCount: number): SmartSession` (advances the tick, sets lastSeen, and schedules the forced return `dueTick = tick + 4`, i.e. after 3 other cards, or at the end when `idsCount − 1 < 3`); `nextBox(box, knew): number`; `shuffleOrder(rng, ids): string[]`.

- [ ] **Step 1: Failing tests**
  - `nextBox`: knew moves up (capped at 5); missed goes back to 1.
  - **Starvation:** 20 cards all in box 5 except one in box 1, simulated for 400 picks with "knew" always → every card is shown at least once, and the box-1 card (which moves up) appears more often in the first 50 picks than any single box-5 card.
  - **Forced return:** 10 cards; miss card X at some point → X is shown again exactly as the 4th card after (3 others in between), even if its score is low.
  - Fewer than 3 others: 2 cards, miss A → B, then A again.
  - Deterministic: the same state gives the same next card. Ties go by lower box, then deck order.
  - `shuffleOrder(createRng(1), ids)` is a permutation, and a different seed gives a different order.
- [ ] **Step 2–4:** RED → implement → GREEN. **Step 5:** commit `feat(major): smart scheduler and shuffle order`.

---

### Task 4: Decks store

**Files:** `src/stores/decks.ts`. Test: `src/stores/decks.test.ts`.

**Produces:** `DECKS_KEY = 'mt:decks'`; `useDecksStore()` with state `decks: Deck[]`, `studySelection: string[] | null` and `answeredThisSession: number`; getters `getDeck(id)`; actions `createDeck(name): Deck`, `renameDeck(id, name)`, `deleteDeck(id)`, `addCard(deckId, input, output)`, `updateCard(deckId, cardId, input, output)`, `removeCard(deckId, cardId)`, `applyImport(deckId, plan, mode)` (rejects a plan with errors and writes nothing), `recordAnswer(deckId, dir, cardId, knew)` (updates the box, counts and lastAnsweredAt, increments `answeredThisSession`). Everything persists immediately. Loading uses `loadJson(…, Array.isArray)`.

- [ ] **Step 1: Failing tests** (mocked storage): create/rename/delete persist; a reload keeps decks; `recordAnswer` moves box 1→2 then a miss → 1, with counts kept and a forward/reverse split; `updateCard` keeps progress; `applyImport` with errors throws and leaves storage unchanged; a malformed `mt:decks` (`'{"a":1}'`) → `decks` is `[]`.
- [ ] **Step 2–4:** RED → implement → GREEN. **Step 5:** commit `feat(major): decks store`.

---

### Task 5: Deck list and deck management views

**Files:** `src/views/MajorView.vue`, `src/views/DeckView.vue`, `src/features/major/ImportPanel.vue`, `src/features/major/StudySetup.vue`. Modify `src/router/index.ts` (routes) and `src/views/HomeView.vue` (the Major tile). Test: `src/features/major/views.test.ts`.

- `MajorView`: the list of decks (name, card count, known-well %), a "New deck" input + button, and an **empty state** with the example (`00 - sos` … `05 - solz`) and a link to create one.
- `DeckView`: the deck name (renamable), **Study** (`StudySetup`: mode smart/shuffle/pick, direction forward/reverse, and for pick the checklist plus the range box with inline problems; Start sets `studySelection` and navigates to `study`), a **Cards** table (inline edit and delete, plus an add row), **Import** (`ImportPanel`: a file input accepting `.csv,.json,.txt` and a paste textarea → preview counts + an error list → Replace/Keep/Cancel; Apply is disabled while there are errors), **Export** (CSV/JSON buttons), **Stats** (direction toggle; known well; success; weakest list), and **Delete deck** with an in-page confirmation.
- Home: the Major tile linking to `/major`.

- [ ] **Step 1: Failing tests** (router + Pinia + mocked storage): the empty state shows `00 - sos`; creating a deck navigates to it; pasting `00 - sos\n01 - sat` and confirming shows 2 cards; a paste with an error line shows `line 2` and disables Apply; Replace vs Keep on a conflict; the range box `0-1` shows problems for `x`; the Home tile shows `no decks yet`, then `1 deck · 2 cards`.
- [ ] **Step 2–4:** RED → implement → GREEN. **Step 5:** commit `feat(major): deck list, management, import and export UI`.

---

### Task 6: Study view

**Files:** `src/views/StudyView.vue`. Test: `src/features/major/study.test.ts`.

The view reads `mode` and `dir` from the query and the selection from the store (null → all cards). It calls `beginActivity('major')` on mount and `endActivity()` on unmount. The smart session uses `createSmartSession`; shuffle uses `shuffleOrder(createRng())` (the rng can be injected via a prop for tests) plus a summary at the end with **Again**. The card shows the prompt (input, or output in reverse), then **Flip**, then the answer plus **Knew it / Didn't**. Keys: Space/Enter flip (when no button is focused); → or `k` = knew; ← or `d` = didn't. The header shows the counter and a **Done** link back to the deck. An empty selection shows "No cards selected" with a back link.

- [ ] **Step 1: Failing tests:** smart with 3 cards: flip → knew → the next card, and the counter updates; a miss brings the card back after 3 others (with 5 cards); reverse shows the output as the prompt and updates the reverse progress only; shuffle shows each card exactly once, then the summary, and **Again** restarts; the session is active while mounted and inactive after unmount; `k` / `d` keys work after a flip and are ignored before it.
- [ ] **Step 2–4:** RED → implement → GREEN. **Step 5:** commit `feat(major): study view`.

---

### Task 7: Docs, full checks, push

- [ ] Update the README (tick Major System Flashcards; add a "Flashcard file format" section with CSV/JSON/paste examples), `docs/agents/context/architecture.md` (the `mt:decks` key, features/major), and `CLAUDE.md` (features/ in the layout).
- [ ] Full checks + format; commit `docs: flashcards format and architecture`; `git push -u origin feat/major`.
