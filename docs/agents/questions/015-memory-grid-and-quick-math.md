# 015 — Two new modules: Memory Grid and Quick Math

- **Status:** answered
- **Asked by:** builder · **Date:** 2026-11-18
- **Plan / task:** plans 12 (Memory Grid) and 13 (Quick Math), being written

## Context
The owner proposed both (2026-11-18), in their words:
- "memory grid (a n x n grid with 2 states, on and off), for a little bit of time, the grid has 2 states, then all of it is off and the player has to tap to make the grid back to the original form"
- "math fast simple operations (like multiplications divisions modulos and others)"

## Proposal A — Memory Grid (`memory-grid`)
1. A round shows an N×N grid with some cells on, for a short time; then all cells turn off; the player taps cells to toggle them on/off and presses **Check**.
2. **Levels 1–12** (shared staircase, `upAfter` setting 3–5): 3×3/3 on · 3×3/4 · 4×4/5 · 4×4/6 · 4×4/7 · 5×5/8 · 5×5/9 · 5×5/10 · 6×6/11 · 6×6/12 · 6×6/14 · 7×7/16.
3. **View time** = 1.0 s + 0.15 s per lit cell (L1 ≈ 1.45 s, L12 ≈ 3.4 s), × a `timeMultiplier` setting 0.5–2 (as in Plates/Maze), floor 0.5 s. Timed with `useCountdown`.
4. **Scoring:** success = exactly the original pattern. Accuracy = hits / (hits + misses + wrong taps) (the N-back formula, so tapping everything doesn't score). Result screen overlays the answer: correct, missed, wrong — with shapes/marks, not only colour.
5. Keyboard: roving-tabindex grid (arrows; native Enter/Space toggles, like Card Match); **Check** button. Touch: tap.
6. Summary: `best level <n>` · Rounds · Best level · Accuracy (last 10) · Success (last 20).

## Proposal B — Quick Math (`quick-math`)
1. A **sprint**: problems appear one at a time; type the answer and press Enter (or the on-screen ✓); the next appears instantly. Sprint length setting 30–180 s (default 60). Wrong answers show the correct one briefly (400 ms) and move on.
2. **Operations** (boolean settings, at least one on; if all off → all on): `+` `−` `×` `÷` `mod` (default: all on). Division always has an exact integer result; subtraction never negative; `mod` divisor ≥ 2.
3. **Levels 1–10** set the number ranges, e.g. L1: operands 1–9 (× tables to 5); L5: two-digit ± and × up to 12; L10: three-digit ±, two-digit × two-digit, ÷ with up to 3-digit dividend. Exact table in the plan.
4. **Success** (for the staircase) = accuracy ≥ 90% **and** at least `targetCorrect(level)` correct answers in the sprint (scaled by sprint length, e.g. 15 per 60 s at every level). Below 60% accuracy drops a level (three zones, as in N-back).
5. Input: numeric keyboard (`inputmode="numeric"`), Enter submits; empty Enter ignored; held Enter ignored (shared rule).
6. Summary: `best level <n>` · Rounds · Best level · Correct per minute (best) · Accuracy (last 10).
7. Theory note: arithmetic is working-memory load, not mnemonic recall — is it in scope? (The owner asked for it, so the builder assumes yes.)

## Why it matters
Defines both modules' difficulty curves and success rules.

## Answer
(manager) **Both approved, with the changes below.** The owner asked for both modules and prefers not to be asked, so these are my calls. For each module: follow the `add-minigame` skill, add an entry to `decisions/log.md` and a section to `memory-theory.md`, and don't write `docs/<module>/`. Both use the round flow from answer 006 and the settings snapshot from answer 004.

### A — Memory Grid: approved
1. **Mechanics: approved.** Tapping a cell toggles it, so a second tap undoes it. Add a **Clear** button. Check is always allowed, even with nothing on. The lit cells are distinct and chosen with the seeded RNG, and the same pattern never appears twice in a row.
2. **Levels: approved** as listed. Keep them in a typed constant with a test that no level is easier than the one before (a larger grid or more lit cells, never fewer). Check that 7×7 fits at 400 px with touch-sized cells.
3. **View time: approved:** `max(0.5 s, (1.0 + 0.15 × lit) × timeMultiplier)`, with a precise hide moment via `useCountdown`.
4. **Scoring: approved.** Success means an exact match, and any other result steps the staircase down. That's the same rule as Plates and Maze, and the staircase settles at the player's limit. Accuracy uses the N-back formula. The result overlay marks cells as correct (✓), missed (an outlined ring) and wrong (✗), so colour is never the only cue.
5. **Keyboard and touch: approved.** A roving grid with native button activation, as in answer 009. Each cell's `aria-pressed` reflects its state.
6. **Summary: approved.**

### B — Quick Math: approved, with changes to success and timing
7. **In scope: yes.** The owner asked for it. Spec §1 calls the app a memory gym for short-term memory, and mental arithmetic loads working memory, but it isn't mnemonic recall, so be honest about that. Set Trains to "Working memory under load — fast mental arithmetic". The `memory-theory.md` entry should say it's a warm-up and working-memory drill, not a memory technique.
8. **Sprint: approved.** Time the sprint with `useCountdown`, so a hidden tab pauses it. The 400 ms reveal of the right answer counts against the sprint; that's the cost of an error. Input is disabled during it. Quitting mid-sprint records nothing.
9. **Operations: approved.** Each problem picks uniformly among the enabled operations, and the same problem never appears twice in a row. If every operation is off, sanitize to all on, and show a hint under the checkboxes. Every answer is a **non-negative integer** (no negative subtraction, exact division, divisor never 0, `mod` divisor ≥ 2, non-negative operands), so `inputmode="numeric"` is enough and no minus key is needed. Show the operators as `+ − × ÷ mod`, using U+2212 for minus. Answers are compared as integers after trimming, so `07` equals `7`. Put the level table in `logic.ts`, with tests that each generator respects its ranges and integer rules for many seeds.
10. **Success (changed): the target depends on the level, not a flat 15 per minute.** Three-digit and two-digit-by-two-digit problems can't be solved as fast as single-digit ones. Add `targetPerMinute` to each level row, falling as the problems get harder (about 20 at L1 down to about 6 at L10; you calibrate it, and the owner can tune it after playing). The target is `round(targetPerMinute × sprintSeconds / 60)`. The three zones, as in N-back:
    - accuracy ≥ 90% **and** correct answers ≥ the target is a success, and the level goes up;
    - accuracy below 60% is a failure, and the level drops by 1;
    - anything else keeps the level and resets the streak.
    - Accuracy = correct / attempted, and 0 when nothing was attempted. Reuse N-back's three-zone helper. If it lives in `n-back/`, move it to `core/difficulty/` with its tests unchanged rather than importing one game from another.
11. **Input: approved.** Enter submits, and Enter on an empty input is ignored. Show the ✓ on-screen button, plus feedback with ✓ or ✗ and the correct answer, not colour alone.
12. **Summary: approved.** Store `metrics: { correct, attempted, sprintMs }`. Correct answers per minute = correct / (sprintMs / 60000).

## Owner decision
(2026-11-18) Memory Grid starts at **4×4** and goes up to **13×13**. The builder stretched the curve to 20 levels (two per grid size, lit cells growing every level): 4×4/4 · 4×4/5 · 5×5/6 · 5×5/7 · 6×6/8 · 6×6/9 · 7×7/10 · 7×7/11 · 8×8/12 · 8×8/13 · 9×9/14 · 9×9/15 · 10×10/16 · 10×10/17 · 11×11/18 · 11×11/19 · 12×12/20 · 12×12/22 · 13×13/24 · 13×13/26. View time formula unchanged (1 s + 0.15 s per lit cell → 1.6 s … 4.9 s).

