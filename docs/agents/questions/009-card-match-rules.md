# 009 — Card Match: levels, preview, what "success" means, memory mistakes

- **Status:** answered
- **Asked by:** builder · **Date:** 2026-11-10
- **Plan / task:** plan-5 (Card Match), being written

## Question
Spec §6.5: the classic pairs game; an optional preview (0 = none); a move = flipping two cards; the score is compared with the fewest moves possible (= pairs); "memory mistakes" are counted; simple symbols; the grid grows 2×3 → 3×4 → 4×4 → 4×5 → 6×6 via the staircase. Proposals for what's open:

1. **Levels** (staircase +1 after 3 successes in a row, −1 per failure): 1: 2×3 (3 pairs) · 2: 3×4 (6) · 3: 4×4 (8) · 4: 4×5 (10) · 5: 4×6 (12) · 6: 6×6 (18). I added 4×6 so the jump from 10 to 18 pairs isn't so steep. Grids are rendered with the longer side horizontal on wide screens and vertical on narrow ones.
2. **Preview setting:** `previewSecondsPerPair` 0–3 s (step 0.25), **default 0.5** (so a 2×3 grid shows for 1.5 s and 6×6 for 9 s). 0 = no preview, which is the classic exploration game. Esc or Skip ends the preview early.
3. **Memory mistake** (exact definition): at a mismatched move with first card A and second card B, count **1** if either (a) the location of A's partner was already known (seen face-up earlier) but B isn't that card, or (b) B itself had been seen before and is not A's partner. Cards seen in the preview count as "seen", so with a preview, every mismatch is a memory mistake. At most 1 per move.
4. **Success** (for the staircase): **zero memory mistakes** in the round. The moves-above-minimum number is shown and recorded, but luck in the no-preview mode shouldn't block leveling up.
5. **Flip-back:** a mismatched pair stays face-up for 700 ms, or until the next card is clicked (which flips them back immediately). Matched pairs stay face-up, dimmed.
6. **Symbols:** an original set of 18 inline SVG shapes (circle, square, triangle, star, heart, moon, …), each with a distinct token-based color, so pairs are distinguishable by shape *and* color. No images, no copyrighted art.
7. **Keyboard:** cards are buttons in grid order (Tab/Shift+Tab plus Enter/Space to flip), plus arrow-key navigation inside the grid. Touch is just tapping.
8. **Round result:** `metrics: { pairs, moves, extraMoves: moves − pairs, memoryMistakes, preview: 0|1 }`; `accuracy = pairs / moves`.

## Why it matters
Definitions 3–4 decide what the game measures and how the player progresses.

## Answer
(manager) **All eight approved, with the clarifications below.** Spec §13 leaves defaults and details to the builder, so these are my calls. No escalation needed.

1. **Levels: approved,** including 4×6. Spec §6.5 says "e.g.", so an extra step is fine. Use fixed staircase steps (+1 after 3 successes, −1 per failure), the same as Plates and Maze until step settings are revisited for all adaptive games at once. Orientation: the longer side runs horizontally on wide screens and vertically at narrow widths. Check 6×6 at 400 px.
2. **Preview: approved.** `previewSecondsPerPair`, 0–3, step 0.25, default 0.5, and 0 means no preview (spec §6.5). Time the preview with `useCountdown` so the hide moment is precise. Skip or Esc ends it early (Esc calls `preventDefault`, as in answer 001).
3. **Memory mistake: approved exactly as written.** One rule to pin in tests: "seen" means the card was face-up at any moment before this move, in the preview or in an earlier move. A card that is already matched is out of play. Test each case: (a) partner known but missed; (b) a known non-partner chosen while unseen cards remain; an unseen A then an unseen B, which is no mistake; at most 1 per move; and with a preview, every mismatch is a mistake.
4. **Success means zero memory mistakes: approved.** It is as strict as the other games (exact recall), and it doesn't punish bad luck when there's no preview, which is the spec's reason for counting memory mistakes. With a preview, this means perfect play. The staircase then settles where the player mostly succeeds, which is the "train at your limit" goal (spec §2).
5. **Flip-back: approved.** A mismatched pair stays face-up for 700 ms, timed with `useCountdown` (never `setTimeout`). Uniform rule for clicks during that window: any card click first flips both cards back, then is handled normally. If the clicked card is now face-down, it becomes the first card of the next move. Matched pairs stay face-up, dimmed and disabled.
6. **Symbols: approved, with one condition.** The 18 original inline SVGs must be distinguishable **by shape alone**, so colour-blind players can play. Colour is an extra cue. Colours come from a small symbol palette added to `tokens.css` (e.g. `--sym-1…--sym-6`), never hard-coded. Each face-up card has an `aria-label` with the symbol's name, and face-down cards are labelled "Hidden card".
7. **Keyboard: approved.** Use a roving tabindex: the grid is one Tab stop, the arrow keys move between cards, and Enter or Space flips through the native button activation. Don't also handle Enter for cards in `useGameKeys`, so it can't fire twice (the bug found in Number Flash's review).
8. **Round result: approved.** `level` is the grid level. `durationMs` runs from the end of the preview to the last match and excludes time while the tab is hidden (spec §5.3: the round pauses, including the flip-back timer). Stats (spec §6.5): moves above the minimum, memory mistakes, time, and "largest grid cleared". Every round ends with the grid cleared, so count only successful rounds for that stat (the same pattern as Long Number's "best").

Round flow between rounds: the result screen, then Next or Enter with the 300 ms guard (answer 006).
