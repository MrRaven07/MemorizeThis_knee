# 012 — New module with playing cards: "Deck Memory"

- **Status:** answered
- **Asked by:** builder · **Date:** 2026-11-11
- **Plan / task:** plan-9 (new module), being written

## Context
The owner asked for one more module "with playing cards" after the spec's modules, and said explicitly that the builder should not ask them, only the manager. Memorizing a shuffled deck is *the* classic memory-sport discipline (Speed Cards; people use PAO / person-action-object images placed along a memory palace route), so it fits the app's theory perfectly.

## Proposal
1. **Name / id:** "Deck Memory" / `deck-memory`. Tagline: "Memorize the order of shuffled playing cards, then rebuild it." Trains: "Memorizing card sequences — the memory-sport classic (PAO + memory palace)".
2. **Cards:** a standard 52-card deck drawn in CSS/SVG (rank + suit ♠ ♥ ♦ ♣, with red hearts and diamonds). Original drawing, no images, no jokers. Card ids 0–51. Codes like `AS`, `10H`, `QD`.
3. **Levels** (staircase: +1 after 3 perfect rounds, −1 per failure): cards per round `4, 6, 8, 10, 13, 16, 20, 26, 39, 52` (levels 1–10).
4. **Memorize phase:** a time limit = cards × `secondsPerCard` (setting 1–20 s, step 0.5, **default 5 s**), with a **Done** button to stop early. The **memorization time used** is recorded (`metrics.memoMs`), the memory-sport stat.
   - Display setting `view`: **`one`** (one card at a time, ←/→ or swipe buttons to move back and forth, like flipping through a deck, which is true to the discipline) or `row` (all cards laid out in order, wrapping). **Default `one`.**
5. **Recall phase:** rebuild the order by tapping cards in a **picker** (4 suit rows × 13 ranks; cards already used are dimmed and can't be picked twice), with **Undo** and **Clear**. The answer so far shows as a strip of small cards. A text alternative: typing codes (`AS 10H QD …`) in a box parses them (an invalid token is shown inline). No time limit. **Check** submits when all N are placed, or early with fewer.
6. **Scoring:** sequence alignment like the digit games, but over card tokens. I'd generalize `alignStrings` in core to `alignSequences<T>(expected, actual, equals)` (and keep `alignStrings` as a wrapper), so a skipped card only costs that card. Success = exact order. `accuracy` = the alignment accuracy. `metrics: { cards, correct, memoMs }`. The result screen shows expected vs answer per position (match / wrong / missing / extra) with mini cards.
7. **Summary:** headline `best <n> cards` (largest perfect round) / `no perfect round yet` / `not played`. Stats: Rounds, Largest perfect, Fastest perfect memorization for the largest size (`m:ss`), Success (last 20).
8. **Keyboard:** memorize: ←/→ move, Enter = Done, Esc = Done (prevented, so the shell doesn't quit). Recall: the picker cards are buttons in a roving grid like Card Match. Backspace = Undo when the text box isn't focused.

## Why it matters
It decides the scope of the new module and a small core refactor (`alignSequences`).

## Answer
(manager) **Approved, with the changes below.** The module is outside the spec, and the coordinator relayed that the owner told the builder to build it without asking them. So I'm deciding everything here, guided by the spec's intent: a precise, fair trainer that a Vue learner can read. Record the owner's instruction and this module in `docs/agents/decisions/log.md`. Add a PAO / Speed Cards section to `docs/agents/context/memory-theory.md`. Follow the `add-minigame` skill. Don't write `docs/deck-memory/`.

1. **Name, id, tagline, trains: approved.** "Deck Memory" is clearly distinct from Card Match.
2. **Cards: approved.** Draw them as original CSS/SVG, with a light card face like a real card (the same reasoning as the white plates). The suit colours come from tokens (e.g. `--suit-red`, `--suit-black`), never hard-coded. The suit symbol and rank are always shown, so colour is never the only cue. Each card has an `aria-label` such as "Queen of diamonds". Deal with `createRng().shuffle` and take the first N.
3. **Levels: approved** as `4, 6, 8, 10, 13, 16, 20, 26, 39, 52`. Fixed staircase steps (+1 after 3 perfect rounds, −1 per failure), the same as the other adaptive games until steps are revisited. Keep them in a typed constant with a test that the counts strictly increase.
4. **Memorize: approved.** Limit = cards × `secondsPerCard` (1–20, step 0.5, default 5), timed with `useCountdown`. Done, Enter or Esc ends it (Esc calls `preventDefault`, answer 001). `metrics.memoMs` is the elapsed visible time when the phase ends, so hidden time is excluded (spec §5.3). The `view` setting is `one` (default) or `row`. In `one` view, show the position ("7 / 20"), and ←/→ plus on-screen buttons move through the cards. No swipe gestures, because the buttons cover touch. Check `row` with 52 cards at 400 px.
5. **Recall: approved, with one simplification.** The answer is **one array of card ids**, and that array is the single source of truth.
   - **Picker:** tapping a card appends it. Used cards are dimmed and disabled. Undo removes the last card, and Clear empties the answer. Don't add mid-sequence insertion; alignment scoring already makes an early slip cost only that card.
   - **Text box:** it is not a mirror of the answer. On Enter it parses the tokens, appends the valid ones, and keeps the bad ones in the box with an inline error (invalid code, or a card already used).
   - **Accepted codes:** case-insensitive, ranks `A 2–10 T J Q K`, suits `S H D C` or `♠ ♥ ♦ ♣`. Enter in an *empty* text box means Check.
   - Check with fewer than N cards is allowed, and the missing cards are scored as missing. No recall time limit.
6. **`alignSequences`: approved, without changing any existing behaviour.** Add `alignSequences<T>(expected: readonly T[], actual: readonly T[], equals = Object.is)` returning generic ops (`{ kind: 'match'; item: T }`, and so on), with the same tie-break and accuracy formula. `alignStrings` stays a wrapper: it applies NFC and splits by code point as before, then maps to the existing `DiffOp` shape. `ResultDiff` and the other games stay untouched. All existing `align.test.ts` tests must pass unchanged. Add generic tests that use numbers.
   - Success = exact order. `accuracy` = the alignment accuracy, `level` = the level. `metrics: { cards, correct, memoMs }`. The result screen shows the aligned ops with mini cards. Round flow: Next or Enter with the 300 ms guard (answer 006). Settings snapshot when the round starts (answer 004).
7. **Summary: approved** as proposed. On the Stats page it gets the "Level by day" sparkline automatically (answer 011).
8. **Keyboard: approved.** The picker is a roving grid with native button activation (answer 009). Backspace means Undo only outside the text box, which `useGameKeys` already ensures. Check is a button, or Enter in the empty text box.
