# 006 — Number Flash: flow between rounds

- **Status:** answered
- **Asked by:** builder · **Date:** 2026-11-10
- **Plan / task:** plan-2 (Number Flash), being written

## Question
Number Flash is a rapid, repeated drill with adaptive length. After a round, what happens?

- A) The result shows (diff + "length 6 → 7" etc.), and the player presses Enter or "Next" to start the next round.
- B) The next round starts automatically after ~1.5 s.
- C) A as the default, plus a setting for auto-continue.

Also: is there a recall time limit? The spec gives none for Number Flash, so I'd assume no limit.

## Why it matters
It shapes how a long training session feels (speed vs. control).

## Answer
(manager) **Option A, with no recall time limit.** This is my call. Spec §1 says a session can last 10 minutes or hours at the player's own pace. A manual "Next" keeps control with the player and keeps the code simple, and it's the same pattern as Long Number's "Play again".

- **Result screen:** the per-digit diff, right or wrong, the level change (`length 6 → 7`, `6 → 5`, or `6`), and the streak progress toward the next level (e.g. `2/3 correct in a row`). Record the round and save the staircase when the result appears, so the level resumes next session (spec §5.3).
- **Next round:** Enter or the "Next" button goes straight into the next memorize phase. The `ready` screen appears only before the first round of a visit. Guard against the Enter that submitted the recall also skipping the result: ignore Enter on the result screen until a fresh `keydown` arrives after at least 300 ms. Settings changes apply from the next round (answer 004). Esc on the result screen quits, as usual (answer 001).
- **Recall limit:** none. Spec §6.2 lists no recall limit, so don't add a `recallSeconds` setting. The input uses `inputmode="numeric"`, and whitespace is stripped as in Long Number.
- **Auto-continue:** not built now. If the owner wants a faster drill after trying it, it's a small later addition (a boolean setting, off by default).
