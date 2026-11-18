# 017 — Kim's Game

- **Status:** answered
- **Asked by:** builder · **Date:** 2026-11-18
- **Plan / task:** plan 15

## Context
The owner asked for it (2026-11-18): "A tray of 10–20 objects appears, then disappears. The player lists them all, or says which one went missing. This is a classic scout and sniper exercise."

## Question
How do objects look, how does the player "list" them without free typing (synonyms, spelling), how does difficulty scale, and how is it scored?

## Answer
(manager) The owner prefers not to be asked; these are my calls, in line with spec §1 and answers 004/006/014/015.

1. **Objects.** A fixed catalogue in `objects.ts` of at least 80 everyday objects, each `{ id, emoji, name }` (e.g. `{ id: 'key', emoji: '🔑', name: 'key' }`). Pick emoji that are visually distinct and render on Android (Unicode ≤ 13, no ZWJ sequences, no flags). The name is the cell's `aria-label` and is shown under the emoji in the recall picker. Test: ids and emoji are unique.
2. **Tray.** Objects are drawn without repeats with the seeded RNG and placed in random cells of a tray grid (5×4 for up to 20 objects; free cells stay empty), so position is part of the memory (method of loci). Never the same tray twice in a row.
3. **Two modes** (`mode` select setting, default `list`). Each mode has its own level, staircase key `kims-game:<mode>` (as in N-Back).
   - **List all (`list`).** After the tray hides, a **picker** shows the tray's objects mixed with the same number of distractors from the catalogue (shuffled, ordered differently from the tray). The player taps the ones that were on the tray (tap toggles) and presses **Check**. No typing: it avoids synonym and spelling problems and works on touch.
   - **What's missing (`missing`).** After the tray hides, a short blank (`gapMs`, 1 s, via `useCountdown`), then the tray comes back **in the same positions** with `k` objects removed (their cells empty). The player picks the missing ones from a picker of `k` correct + `max(4, 2k)` distractors, then **Check**. `k` grows with level (see 5). The empty cells are not highlighted.
4. **View time.** `max(1 s, (2 s + 0.8 s × objects) × timeMultiplier)`; `timeMultiplier` setting 0.5–2 step 0.25 (default 1), as in Plates/Maze/Memory Grid.
5. **Levels** (typed constant, test that no level is easier than the previous):
   - `list`: L1–L11 = 10…20 objects (one more per level).
   - `missing`: L1–L11 = 10…20 objects; `k` = 1 for L1–4, 2 for L5–8, 3 for L9–11.
   Staircase start 1, `upAfter` setting 3–5 (default 3).
6. **Scoring.** Accuracy = hits / (hits + misses + wrong picks) (N-Back/Memory Grid formula, so tapping everything doesn't pay). **Success = every object right and no wrong picks**; anything else steps down (same rule as Plates/Maze/Memory Grid). Metrics: `{ objects, missing (k or 0), hits, misses, wrong, viewMs }`.
7. **Result screen.** Shows the original tray with each object marked ✓ (recalled), ring (missed) and the wrong picks listed with ✗ — never colour alone.
8. **Input.** Picker and tray cells are buttons in a roving-tabindex grid (arrows; native Enter/Space toggles; `aria-pressed`), as in Card Match / Memory Grid. **Check** is always allowed. Enter on the intro/result starts the next round (answer 006).
9. **Summary.** Headline `best <n> objects` (highest level passed, any mode, shown as object count) or `not played`; stats: Rounds, Best (list), Best (missing), Accuracy (last 10), Success (last 20).
10. **Theory.** Trains: "Rapid visual encoding of many objects and their places". `memory-theory.md` entry: Kim's Game (from Kipling's *Kim*, used in scout and sniper training) — fast observation, linking each object to a tray position (a mini palace) or a story chain; the missing variant trains noticing change.

## Owner decision
(none needed)
