# 005 — Number Flash: how the gradual reveal fits the display time

- **Status:** answered
- **Asked by:** builder · **Date:** 2026-11-10
- **Plan / task:** plan-2 (Number Flash), being written

## Question
Spec §6.2 says digits appear one at a time, the number stays visible until **4 s after the round started** (+0.5 s per digit beyond 4), then hides. With a slow reveal speed and a long number, the reveal could eat most or all of the display time (e.g. 12 digits × 600 ms = 7.2 s against 8 s).

Options:
- A) Display time counts from the round start, as the spec says. Clamp it so the complete number is always visible for at least 1 s after the last digit appears.
- B) Display time counts from the moment the last digit appears.
- C) Keep the spec literally, and let the player tune the reveal speed.

## Why it matters
It decides how long the player actually sees the complete number, which is the core difficulty of the drill.

## Answer
(manager) **Option A, with a precise floor.** Spec §6.2 says the number hides "4 s after the round started", and the (builder's call) formula is 4 s + `extraPerDigit` × (length − 4). Both stay exactly as written: the reveal is part of the viewing time. The floor is my call, made to protect the spec §2 fairness and timing anti-goals:

- `displayMs = max(4000 + extraMs × (length − 4), lastDigitAtMs + 1000)`. The complete number is always on screen for at least 1 s. Put this in `logic.ts` as a pure function with tests, including a case where the clamp applies.
- Pick a default reveal speed so the clamp never applies with default settings. I suggest 250 ms between digits, with the first digit at t = 0. With the defaults, the full-number view is then 2.25 s + 0.25 s × length, so it grows with length.
- Schedule each digit's appearance and the hide moment from the round's start time, using `performance.now()` and rAF (`useCountdown`). Never chain timeouts, because chained timeouts drift (spec §5.3). If the tab is hidden, the reveal and the countdown pause together.
- "All at once" mode: the whole number shows for `displayMs`, and the floor does not apply.
- No UI is needed to explain the clamp. A help line on the reveal-speed field is enough: "If the reveal is slow, the full number still stays visible for at least 1 s."
