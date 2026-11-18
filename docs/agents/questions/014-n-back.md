# 014 — N-Back module

- **Status:** answered
- **Asked by:** builder · **Date:** 2026-11-18
- **Plan / task:** plan-11 (N-Back), being written

## Context
The owner chose N-back as the next module (2026-11-18). It's a working-memory drill: a stream of stimuli; the player responds when the current stimulus matches the one N steps back.

## Proposal
1. **Name / id:** "N-Back" / `n-back`. Trains: "Working memory — holding and updating the last N items".
2. **Modes (setting `mode`):** `position` (a square lights up on a 3×3 grid; default), `digit` (a digit 0–9 is shown), `dual` (position + digit at once, two match buttons). Single modes first; dual uses the same engine with two streams.
3. **Round:** 20 + N trials. Each trial shows the stimulus for 500 ms, then a blank, for a 2500 ms trial (setting `trialMs` 1500–4000, step 250). Trials are timed with `useCountdown`, pausing on a hidden tab.
4. **Stream generation:** seeded RNG; exactly ~30% of the scorable trials (those with index ≥ N) are targets (a match with N back), placed at random; non-targets are never accidental matches. Also avoid "lures" being all at N±1? No — keep it simple: no lure control.
5. **Response:** a big "Match" button (and key `M` / Space; for dual: `A` = position, `L` = digit). One press per trial; pressing on a non-target is a false alarm; not pressing on a target is a miss.
6. **Scoring:** hits, misses, false alarms, correct rejections. Accuracy = (hits + correct rejections) / scorable trials. Success (for the staircase) = accuracy ≥ 80%. Level = N (1–9), staircase: +1 after 3 successful rounds, −1 per failed round, start N=2, with the shared `upAfter` setting (3–5).
7. **Feedback:** after each press a brief green/red flash on the button (setting `feedback`, default on). Result screen: N, hits/misses/false alarms, accuracy, level change.
8. **Summary:** headline `best N=<n>`; stats: Rounds, Highest N passed, Accuracy (last 10), Success (last 20). The Stats trend uses `level` per day automatically.

## Why it matters
Defines the scope, the success threshold, and the timing.

## Answer
(manager) **Approved, with changes to scoring, success and levels (points 6, 2 and 4).** The owner asked for this module and prefers not to be asked, so these are my calls. They're guided by the spec's intent: precise and fair (§2), with adaptive difficulty at the player's limit (§5.3). Log the module in `decisions/log.md` and add an N-back section to `memory-theory.md`. Follow the `add-minigame` skill, and don't write `docs/n-back/`.

1. **Name, id, trains: approved.**
2. **Modes: approved** (`position` by default, `digit`, `dual`). **Each mode has its own staircase**, saved as `n-back:position`, `n-back:digit` and `n-back:dual` through `getStaircase` and `saveStaircase`. Dual is much harder, and switching modes must not drag one level down to the other. Record `metrics.mode` as 0, 1 or 2. Audio stimuli are out of scope for now.
3. **Round and timing: approved** (20 + N trials, 500 ms stimulus, `trialMs` 1500–4000 with step 250 and default 2500). As in answer 005, schedule every trial boundary and every stimulus-off moment **from the round start** with `useCountdown` and `performance.now()`, never chained per trial, so 22 trials don't drift. A hidden tab pauses the whole round. Test the schedule as a pure function. `durationMs` is the visible round time.
4. **Stream: approved, with exact counts.** Each stream has exactly `round(0.3 × 20) = 6` targets, placed with the seeded RNG among the scorable trials (index ≥ N). Non-targets never equal the item N back. No lure control. In dual mode, each stream gets its own independent 6 targets, so both can match on the same trial. Test this: exact target count, no accidental matches, deterministic for a seed. Position mode uses 9 cells, digit mode the digits 0–9.
5. **Response: approved.** The response window is the whole trial (stimulus plus blank), with at most one press per stream per trial; later presses are ignored. Keys: Space or `M` in single modes, `A` (position) and `L` (digit) in dual, and big on-screen buttons labelled with their key. **Don't use Enter**, to avoid the double-fire class of bugs. The buttons are disabled during the first N trials, with a "Remember the first N" hint.
6. **Scoring (changed).** With 30% targets, never pressing at all scores 70% on (hits + correct rejections) / trials, so 80% would reward passivity. Use instead `accuracy = hits / (hits + misses + falseAlarms)`, summed over both streams in dual mode. Still record and show all four counts. Correct rejections are recorded but not in the accuracy.
7. **Success and levels (changed to three zones, the standard N-back rule):**
   - accuracy ≥ 80% is a **success**, and the staircase steps up;
   - accuracy below 50% is a **failure**, and the level drops by 1;
   - in between, the **level stays** and the right-streak resets.
   - Implement this as a small pure helper in `n-back/logic.ts` on top of the existing staircase functions, with tests. No core change.
   - Levels: N from 1 to 9, starting at 2. +1 after `upAfter` successes in a row, using the shared setting as proposed.
   - `RoundResult.success` = the success zone.
8. **Feedback: approved, default on.** Show a brief flash on the pressed button, plus a ✓ or ✗ so colour is never the only cue. Use colours from tokens. Show no feedback for misses during the round (they appear in the result). The result screen and round flow follow answer 006, and settings are snapshotted at round start (answer 004).
9. **Summary: approved, mode-aware.** Headline `best N=<n> (<mode>)`, the highest N passed in any mode, or `not played`. Stats: Rounds, highest N passed per mode played, Accuracy (last 10), Success (last 20). The Stats "Level by day" trend (answer 011) plots `level` across modes. That's acceptable for now; splitting it by mode can come later if it reads badly.
