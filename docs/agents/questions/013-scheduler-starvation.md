# 013 — Smart scheduler: starvation and back-to-back repeats (review findings)

- **Status:** answered
- **Asked by:** builder · **Date:** 2026-11-11
- **Plan / task:** plan-6 final-review fix pass

## Question
The plan-6 reviewer reproduced two problems that follow from ruling 010's scheduler:

1. **Starvation:** with "a missed card returns after exactly 3 others, and the override wins", a player who keeps missing 4 or more cards sees only those cards forever. In 10 cards with 4 always missed, the other 6 got 0 of 400 draws.
2. **Back-to-back repeats:** after a missed card's forced return and a "knew", its overdue score (2/3, then 2/9) still beats recently seen box-5 cards, so it can appear 3 times in a row and climb boxes on short-term memory alone.

Proposal (builder):
- (a) **Never the same card twice in a row** when the session has more than one card: the card just shown is excluded from the score pool.
- (b) **At most 3 consecutive forced draws:** if the last 3 cards shown were all forced returns, the next draw is score-based (from cards not waiting). A forced card then comes back after **at least** 3 others, usually exactly 3.

## Why it matters
Ruling 010 says no card may starve. This amends its "exactly 3" wording.

## Answer
(manager) **(b) approved. (a) is widened into a minimum gap.** This amends answer 010's "exactly 3" to "at least 3". It's my call: answer 010's own goal was "no card starves".

- **(b) Forced-draw cap: approved as proposed.** After 3 consecutive forced returns, the next draw is score-based, chosen from cards that aren't waiting to be forced back.
- **(a) becomes a minimum gap, `K = min(3, poolSize − 1)`, for every draw, forced or score-based.** A card shown within the last K draws is not eligible. "Not twice in a row" alone still allows A, B, A, B, and box promotion based on a few seconds of short-term memory. The gap also gives one uniform rule: every card returns after at least K others, and missed cards after exactly 3 whenever the cap allows. An eligible card always exists, because the last K draws are K distinct cards and K < poolSize. The pool is the deck, or the picked subset in Pick mode. With a pool of 1, the same card simply repeats.
- **Tests to add:**
  - The reviewer's case (10 cards, 4 always missed, 400 draws): every card is drawn, and the 6 cards that are known get a substantial share (at least 1 of every 4 draws between them).
  - No card is drawn twice within any window of K + 1 draws.
  - A missed card returns after at least 3 others, and exactly 3 when there's no pile-up.
  - The output is deterministic for a fixed state.
  - The existing "box 5 appears less often than box 1" test still passes.

For the fix pass, the only change from your proposal is to exclude the last K cards shown instead of just the last one.
