# 008 — Maze: level table, layout and the route input

- **Status:** answered
- **Asked by:** builder · **Date:** 2026-11-10
- **Plan / task:** plan-4 (Maze), being written

## Question
Spec §6.4 fixes the mechanics (grid of open/wall/spike/start/end cells; walls and spikes both lose; typed route in WASD or 1234; extra moves after the end are ignored; a bonus for the shortest route; the maze replays after submit; arrows show while typing; on-screen pad on touch; a solvable path is guaranteed). It leaves the curve and the layout open. Proposals:

**Grid.** Odd sizes (5×5, 7×7, …) so a classic "perfect maze" fits: cells at odd coordinates, walls between. Generate with a randomized depth-first carve, then **open a few extra wall cells (~10%)** so there are loops and more than one route (a pure perfect maze has exactly one route, which makes the "shortest route bonus" meaningless). Start in the top-left corner, end in the bottom-right.

**Spikes.** Placed on open corridor cells (never start, end, or a cell adjacent to start), only where a valid start→end path still exists afterwards (BFS check; regenerate if needed).

**Level table** (staircase as plates: +1 after 3 wins in a row, −1 per loss, levels 1–10):

| L | grid | spikes | view s |
|---|------|--------|--------|
| 1 | 5×5 | 0 | 6 |
| 2 | 5×5 | 1 | 5 |
| 3 | 7×7 | 1 | 7 |
| 4 | 7×7 | 2 | 6 |
| 5 | 9×9 | 2 | 8 |
| 6 | 9×9 | 3 | 7 |
| 7 | 11×11 | 3 | 9 |
| 8 | 11×11 | 4 | 8 |
| 9 | 13×13 | 5 | 10 |
| 10 | 13×13 | 6 | 9 |

Plus a viewing-time multiplier setting (0.5×–2×), as in Plates.

**Success.** Reaching the end = success (and it moves the staircase). The "shortest" bonus is recorded as `metrics.shortest = 1/0` and shown on the result screen ("Shortest route! ★"), but doesn't affect the level.

**Input.** One text input that accepts only the chosen key set (other characters are ignored as you type). Each move shows as an arrow ↑←↓→ under it. Backspace works. Enter submits. The on-screen pad (four arrow buttons + ⌫ + ✓) is always shown below the input, because it's useful on desktop too and makes touch work.

**Replay.** After submit, the maze is shown with the typed path animated step by step (~120 ms per step, instant with reduced motion). It stops at the first wall or spike, which flashes red.

## Why it matters
The level table is the difficulty curve. The extra-openings rule decides whether "shortest route" means anything.

## Answer
(manager) **Approved, with the changes below.** Spec §13 leaves the curve and the layout to the builder, so these are my calls. No escalation needed.

**Grid: no outer wall ring.** Put room cells at **even** coordinates (0, 2, 4, …) and leave the border open, so walking off the grid is the edge (spec §6.4 already makes that a loss). With a border ring, a 5×5 grid has only 2×2 rooms and level 1 would be trivial. Without it, a 5×5 grid has 3×3 rooms, and 13×13 has 7×7. Start in the top-left corner and end in the bottom-right, as proposed.

**Extra openings: approved.** Use a randomized DFS carve, then open about 10% of the remaining walls. Only open walls that separate two rooms (cells with one odd and one even coordinate), never pillars (both coordinates odd). Make the rate a constant in `logic.ts`, not a setting. All randomness goes through `createRng`.

**Spikes: approved.** Spikes go on open cells, never on start, end or a cell next to start, and a BFS must still find a path afterwards. Cap the attempts so generation always terminates: after N failed tries, regenerate the maze; as a last resort, place fewer spikes. Test many seeds and check that every maze is solvable and that the spike count matches the level whenever that's possible.

**Level table: approved as proposed** (levels 1–10, +1 after 3 wins in a row, −1 per loss, with the step values as settings as in the other games). Keep it as a typed constant with a test that difficulty never goes down from one level to the next. The viewing-time multiplier (0.5×–2×) is approved, as in Plates (answer 007), and the hide moment is precise (spec §2). The key set is the existing global `mazeKeys` in the settings store. Don't duplicate it as a per-game setting.

**Success: approved.** Reaching the end is a success, and that is what moves the staircase. Moves after the end are ignored and don't count towards the length (spec §6.4). "Shortest" means the moves up to the end equal the BFS distance computed after the spikes are placed. Record it as `metrics.shortest` (1/0) and show it on the result screen. It doesn't affect the level. Stats: largest maze solved, win rate, shortest rate (spec §6.4).

**Input: approved, with these details:**
- Accept only the chosen key set, case-insensitive (`W` counts as `w`, for Caps Lock). Other characters are dropped. Don't add arrow-key aliases; the spec defines exactly two key sets.
- With the `1234` key set, use `inputmode="numeric"` (spec §9).
- Show the pad always (my call: simpler than detecting devices, and useful on desktop). Pad buttons must not steal focus or open the phone keyboard: use `pointerdown.prevent`.
- The maze stays hidden while the player types, and there is no recall time limit (same as answer 006).

**Replay: approved.** About 120 ms per step, instant with `prefers-reduced-motion` (spec §9). The replay stops at the first wall, spike or step off the grid, and that cell flashes red. If the route ends short of the end, mark the last cell. Enter or "Next" works during the replay (with the 300 ms guard from answer 006), so the replay never blocks the next round. Also add a **"Show a shortest route"** button on the result screen. It draws the route dimmed from the BFS you already compute, which serves the spec's goal that the player "sees exactly where they went wrong".
