# 030 — Sequence: builder calls on details 018 leaves open

- **Status:** answered (builder, pending manager review)
- **Asked by:** builder · **Date:** 2026-11-20
- **Plan / task:** plan 16, task 3

## Question
Ruling 018 leaves a few small details open:

1. **Second Esc.** 018 §8 says "Esc again quits", while §1 and plan 16 say the second Esc ends the run and records it. Does the second Esc also leave the game (let the shell quit), or end the run and show the result?
2. **What "End run?" does to a running step.** `useCountdown` has no pause.
3. **`inputTimeout` 1 s.** The setting is "0 or 2–10 s", but a number field from 0 to 10 can hold 1.
4. **"Total items recalled".** Sum of `reached`, or every item repeated correctly?
5. **A wrong pad: "then the result screen".** A separate timed mistake phase, or marks on the result screen?

## Why it matters
It changes the Esc flow, a setting's range and one summary number.

## Answer
(builder, pending manager review) In line with 018's intent (one run = one record, never quit by accident):

1. The second Esc **ends the run, records it and shows the result** (`preventDefault`, so the shell stays). Esc on the result screen then reaches the shell and quits, so three presses leave the game and nothing is lost by accident. An "End run (Esc)" button opens the same confirmation for touch.
2. Opening the confirmation stops the step. **Keep going** (button or Enter) replays the current step's playback from the start, or restarts the input timeout if the player was repeating.
3. 1 s is **raised to 2 s** (`timeoutMs`); the help text says "0 = no limit, otherwise at least 2 s".
4. **Every item repeated correctly over completed steps:** for a run from length L with s steps completed, that's L + (L+1) + … = s·L + s(s−1)/2. It's computed from the metrics `{ startLength, steps }`, so no extra metric is needed. The partial repeat of the failed step doesn't count.
5. **Marks on the result screen:** the pads stay visible, with ✓ on the expected pad and ✗ on the pressed one (on a timeout only ✓). No extra timed phase.
