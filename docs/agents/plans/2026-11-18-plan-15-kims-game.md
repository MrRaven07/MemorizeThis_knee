# Plan 15 — Kim's Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (or subagent-driven-development). Steps use checkbox syntax.

**Goal:** Kim's Game — a tray of 10–20 objects is shown, hidden, then the player picks all of them (`list`) or the missing ones (`missing`). **Ruling:** `docs/agents/questions/017-kims-game.md` (binding). Follows the `add-minigame` skill. Branch `feat/kims-game` from `main`, in its own worktree (another agent uses the main checkout).

## Constraints (from 017)
- Catalogue ≥ 80 `{ id, emoji, name }`, unique ids and emoji, Unicode ≤ 13, no ZWJ/flags.
- Tray 5×4, objects at random cells, no repeats, never the same tray twice in a row. All randomness via `createRng`.
- Modes `list` | `missing` (default `list`), separate staircase per mode: key `kims-game:<mode>`. Levels L1–L11 = 10…20 objects; missing `k` = 1 (L1–4), 2 (L5–8), 3 (L9–11).
- Settings: `mode`, `timeMultiplier` 0.5–2 step 0.25 (default 1), `upAfter` 3–5 (default 3).
- View = `max(1000, (2000 + 800 × objects) × timeMultiplier)` ms; missing mode then a 1000 ms blank; all via `useCountdown`.
- List picker: tray objects + equal number of distractors, shuffled. Missing picker: `k` correct + `max(4, 2k)` distractors; tray returns in the same positions minus `k`, empty cells not highlighted.
- Accuracy = hits / (hits + misses + wrong). Success = perfect; anything else steps down. Metrics `{ objects, missing, hits, misses, wrong, viewMs }`.
- Result: original tray with ✓ / ring / ✗ marks, not colour alone. Roving-tabindex grids, `aria-pressed`, Check always enabled, Enter starts next round.
- Summary headline `best <n> objects` or `not played`; stats Rounds, Best (list), Best (missing), Accuracy (last 10), Success (last 20).
- Docs: decisions log entry, memory-theory module row + Kim's Game section, backlog status → `pushed`. Never `docs/kims-game/`.

## Review focus
1. Picker contents: no duplicates, every tray/missing object present, distractors never on the tray.
2. Missing mode: the returned tray keeps positions; exactly `k` cells empty.
3. Tapping everything scores low accuracy and fails.
4. Mode levels independent; settings changed mid-round apply next round.
5. Layout at 400 px: 5×4 tray and picker of up to 40 items stay touch-sized (wrap/scroll the picker, not the page).

### Task 1: `objects.ts` + tests — catalogue, uniqueness.
### Task 2: `logic.ts` + tests (TDD) — settings/fields/defaults, level table + monotonic test, tray generation, picker generation for both modes, scoring, view time, summary.
### Task 3: `KimsGame.vue` + tests — phases (intro → view → [blank → partial tray] → pick → result), staircase load/save via stats store, keyboard + touch, result overlay; full-round tests for both modes with seeded rng and fake timers.
### Task 4: register in `registry.ts` (after Memory Grid), docs, full checks (`npx vitest run && npm run type-check && npm run lint && npm run build`), `npm run format`, commit, `git push -u origin feat/kims-game`.
