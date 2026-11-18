# Plan 15 — Sequence (Simon-style) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (or subagent-driven-development). Steps use checkbox syntax.

**Goal:** Sequence — colours and tones that grow one item per step, built for very long runs (hundreds of steps). **Ruling:** `docs/agents/questions/017-simon-sequence.md` (binding). Follows the `add-minigame` skill. Game id `sequence`, UI name **Sequence** (no trademarked toy name). Branch `feat/simon-sequence` from `main`, in its own worktree (another agent uses the main checkout).

## Constraints (from 017)
- A run = one growing sequence until the first mistake (or "End run"); one run = one `RoundResult` (`level: null`, `accuracy: null`, `success` = ties/beats previous best for the same pad count; metrics `{ reached, startLength, pads, steps }`).
- Sequence generated lazily from the seeded RNG, append-only, safety cap 999. O(1) work per item; UI shows only current item, `i / n` and the step. Test a simulated run to 500.
- Settings: `pads` 4|6|9 (default 4), `feedback` both|colors|tones (default both), `startLength` 1–50 (default 1), `baseMs` 400–1200 step 50 (default 700), `inputTimeout` 0 or 2–10 s (default 0 = off), `volume` 0–100 (default 60). Intro button "Start from best − 3" when a best exists for the pad count.
- `itemMs = max(250, baseMs − 15 × (step − 1))`, gap 30% of `itemMs`. One `useCountdown` per playback; current item derived from elapsed time (no drift, pauses when hidden).
- Pads: colour tokens added to `tokens.css`, a number/shape label on every pad, 2×2 / 2×3 / 3×3, touch-sized at 400 px.
- Audio: new `src/core/audio/tones.ts` (Web Audio, lazy `AudioContext` on first gesture, pentatonic, 10 ms ramps, silent fallback). Small core addition — note it in the decisions log. Tests stub it.
- Input: tap or keys `1`–`9` (+ numpad), `Q W A S` for 4 pads; ignored during playback. Wrong pad: buzz, ✓ expected / ✗ pressed, then result. Esc mid-run → in-page "End run?" (preventDefault); Esc again ends and records.
- Summary headline `best <n>` or `not played`; stats Runs, Best (4/6/9 pads), Average of last 10, Total items recalled.
- Docs: decisions log, memory-theory row + section, backlog status → `pushed`. Never `docs/sequence/`.

## Review focus
1. Earlier items never change as the sequence grows; same seed → same sequence.
2. Timing at step 300 still matches `itemMs` (no drift, no per-step slowdown).
3. Input ignored during playback; one mistake ends the run exactly once (one emit).
4. Works with audio unavailable; no AudioContext before a user gesture.
5. Colour is never the only cue (labels), `tones` mode keeps pads dark during playback.

### Task 1: `src/core/audio/tones.ts` + tests (with a fake AudioContext).
### Task 2: `logic.ts` + tests (TDD) — settings/fields/defaults, lazy sequence, step timing, input check, best-for-pads helper, success rule, summary.
### Task 3: `SequenceGame.vue` + tests — intro → playback → input → (next step | result), Esc confirm, start-from-best, input timeout; seeded full runs incl. a long one.
### Task 4: register in `registry.ts` (after Kim's Game if present, else after Memory Grid), docs, full checks, `npm run format`, commit, `git push -u origin feat/simon-sequence`.
