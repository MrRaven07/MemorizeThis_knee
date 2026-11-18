# 017 — Simon-style Sequence

- **Status:** answered
- **Asked by:** builder · **Date:** 2026-11-18
- **Plan / task:** plan 15

## Context
The owner asked for it (2026-11-18): "Simon-style Sequence. Colors or tones that grow longer each round. The scope is to make it for many many rounds."

Use a generic name in the UI (**Sequence**, tagline about colors and tones). Don't use the trademarked toy name, its colours-as-branding or its sounds.

## Question
What is a "round", how do we support very long runs ("many many rounds"), and how do colours/tones work?

## Answer
(manager) My calls, in line with the spec and answers 004/006/014/015.

1. **Run vs step.** A **run** is one growing sequence: show length 1 (or the start length), the player repeats it, then the same sequence plus one new pad, and so on, until the first mistake. Each step adds exactly one item; earlier items never change. **One run = one `RoundResult`** (emitted at the first mistake, or when the player ends the run with Esc → "End run", which also records). Metrics: `{ reached, startLength, pads, steps }`, where `reached` = the longest sequence repeated correctly (0 if the first step failed) and `steps` = steps completed in this run. `level: null`, `accuracy: null`; `success` is defined in 7.
2. **Many many rounds.** No upper cap other than a safety limit of **999** steps (the sequence is generated lazily from the RNG, one item per step, never pre-built to a fixed length). Nothing may get slower with length: playback and checking are O(1) per item, and the UI shows only the current item, a progress count `7 / 23` and the step number, never the whole sequence. Test with a simulated run to length 500.
3. **Start length** (`startLength` setting 1–50, default 1) so a strong player doesn't replay 30 easy steps each time. On top of that, a **"Start from best − 3"** button on the intro once a best exists for the current pad count. The opening sequence of length L is shown in full as step 1.
4. **Pads.** `pads` select 4 / 6 / 9 (default 4), laid out 2×2, 2×3, 3×3, large and touch-friendly at 400 px. Each pad has a token colour (add pad colour tokens to `tokens.css` — never hard-coded colours), a distinct **shape/number label** (so colour is never the only cue), and a tone.
5. **Tones.** `feedback` select: `both` (default), `colors` (silent), `tones` (pads stay dark during playback — hard mode, audio only; pads still light when the player taps them). Tones via the Web Audio API in a small `src/core/audio/tones.ts` (an `OscillatorNode` per pad, pentatonic frequencies so any order sounds pleasant, 10 ms fade in/out to avoid clicks). Create the `AudioContext` lazily on the first user gesture (Android/Chrome autoplay rule); if audio is unavailable, the game still works silently. Tests stub the audio module. `volume` setting 0–100 (default 60).
6. **Speed.** Playback time per item `itemMs` = `max(250, baseMs − 15 × (step − 1))` where `baseMs` is a setting 400–1200 step 50 (default 700); gap between items = 30% of `itemMs`. So long runs get faster down to a floor and stay playable. All timing via `useCountdown` (derive the current item from elapsed time inside one countdown per playback, as in N-Back, so 500 items don't drift). The player has no time limit to answer but if `inputTimeout` (setting 0 = off, 2–10 s, default 0) is on, a pause longer than that between taps ends the run.
7. **Success and stats.** Not a staircase game (`level: null`, `accuracy: null`): the length grows inside the run. **`success = true` when the run ties or beats the player's previous best for the same pad count** (the first run with that pad count counts as a success), otherwise false. The component gets the previous best from a pure helper over `stats.roundsFor(id)` (read-only, no storage access).
8. **Input.** Tap/click a pad, or keys `1`–`9` (pad numbers, also numpad) and for 4 pads also `Q W A S`. Input is ignored during playback. A wrong pad: a low buzz tone (if tones on), show the expected pad with ✓ and the pressed one with ✗, then the result screen. Enter starts / restarts (answer 006). Esc during a run → confirm "End run?" in-page (preventDefault so the shell doesn't quit); Esc again quits.
9. **Summary.** Headline `best <n>` (longest `reached`, any settings) or `not played`; stats: Runs, Best (4 pads), Best (6), Best (9), Average of last 10, Total items recalled.
10. **Theory.** Trains: "Sequence span — chunking and storing a growing sequence". `memory-theory.md`: like digit span but serial and cumulative; long runs only work by chunking (groups of 3–4) or mapping pads to numbers and using the Major System / a palace route, which is the point of supporting runs of hundreds.

## Owner decision
(none needed)
