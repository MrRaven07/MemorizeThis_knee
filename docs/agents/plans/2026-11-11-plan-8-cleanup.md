# Plan 8 — Cleanup and polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the minor findings the final reviews deferred (logged as `Final: minor (deferred)` in each plan's ledger), plus the two ruling deviations: the Maze "short route" marker (Q008), and step values as settings for the adaptive games (Q007, which the manager asked to revisit by this plan).

**Architecture:** No new architecture; small, tested changes grouped by area. Branch `feat/cleanup` from `feat/deck-memory`. Push when the last task is green.

**Rulings:** questions 005, 007, 008, 009, 011, 012 (as cited per task).

## Global Constraints
- Plan 1's constraints and `CLAUDE.md` apply. Every behaviour change starts with a test that fails first. Lint before each commit.
- **The level-up step setting** (Q007, deferred): Plates, Maze, Card Match and Deck Memory get `upAfter` ("Correct in a row to level up", 3–5, default 3), the same range as Number Flash. Each staircase config becomes a function of the round's settings snapshot. Existing saved settings sanitize to the default.

## Review Focus
1. **Old saved settings without `upAfter`** load with the default 3. Pinned in Task 1.
2. **A route ending short** marks its last cell, distinct from a wall or spike failure. Pinned in Task 2.
3. **A backup with an inner `mt:version` newer than the app** is rejected without writing. Pinned in Task 5.
4. **bfcache restore** (`pageshow` with `persisted`) resumes session time while a game is open. Pinned in Task 5.
5. **No regressions:** the full suite and lint stay green after every task.

---

### Task 1: Level-up step settings (Q007 deferral)
**Files:** `src/games/plates/logic.ts`, `maze/logic.ts`, `card-match/logic.ts`, `deck-memory/logic.ts` (settings, defaults, fields; `PLATES_STAIRCASE` → `platesStaircase(s)`, and likewise `mazeStaircase(s)`, `cardStaircase(s)`, `deckStaircase(s)`), plus their game components (use the snapshot), and the tests.
- [ ] RED: each `xStaircase({ ...DEFAULTS, upAfter: 5 }).upAfter === 5`; the defaults include `upAfter: 3`; `sanitizeSettings({}, DEFAULTS, FIELDS).upAfter === 3`; one component test per game: with `upAfter: 4`, the streak text reads `/4`.
- [ ] GREEN, then commit `feat(games): level-up step setting for all adaptive games`.

### Task 2: Maze polish (Q008 + review minors)
- The last cell of a `short` route is marked (`MazeGrid` prop `lastAt`, class `last`, styled with a warning outline).
- The key set is snapshotted per round. `RouteInput` gets `maxlength = size² × 2`.
- `metrics.spikes` counts the spikes actually placed.
- [ ] RED tests for the `last` class on a short route, the snapshotted keys, and maxlength; GREEN; commit.

### Task 3: Number Flash, Plates and Card Match polish
- Number Flash: the Q005 help text on `revealMsPerDigit`; "Length 30 (max)" instead of "streak 0/3" at the top; the round record uses the target's length.
- Plates: plate inputs use `autocapitalize="characters"` (a new `RecallInput` prop) and `enterkeyhint` next/done; JEG/BOU are excluded from random generation (still valid); en dashes and other dash punctuation are stripped; `generateRound` is bounded (it relaxes the county rule after 100 tries).
- Card Match: `role="group"`; matched cards get `aria-disabled`; the "Esc to skip the preview" hint only shows with a preview; `finish()` uses the played level.
- [ ] RED tests for each behaviour; GREEN; commit.

### Task 4: Flashcards import polish
- `parseAuto`: the `[` sniff applies only without a file name, and falls back to paste when JSON parsing fails.
- JSON errors render "item N: …" (no "line N:" prefix).
- Text containing U+FFFD (a wrong encoding) produces an error suggesting saving as UTF-8.
- Empty files show a message.
- [ ] RED → GREEN; commit.

### Task 5: Data safety and stats polish
- Backup import rejects a file whose inner `mt:version` is greater than `SCHEMA_VERSION`.
- Session: `pagehide` pauses like `hidden`, and `pageshow` (persisted) resumes while a game is mounted.
- Stats: "day streak" grammar; the sparkline aria-label reads "from X to Y over N days"; tiles keep whitespace between value and label.
- Fold `staircase.extra.test.ts` into `staircase.test.ts`.
- Long Number `durationMs` uses `useActiveTime`.
- [ ] RED → GREEN; commit.

### Task 6: Docs, checks, push
- [ ] Update CLAUDE.md (composables list), architecture.md (Card Match, useActiveTime), and the README; full checks; push `feat/cleanup`.
