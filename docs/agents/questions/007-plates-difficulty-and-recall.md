# 007 — License Plates: difficulty steps and recall details

- **Status:** answered
- **Asked by:** builder · **Date:** 2026-11-10
- **Plan / task:** plan-3 (License Plates), being written

## Question
Spec §6.3 says difficulty goes up by showing several plates at once, at different sizes, and with less viewing time (tilt is a stretch goal). It doesn't say how the steps go. Proposal: the shared staircase over a level 1–12 (+1 level after 3 correct in a row, −1 after a miss; start at 1). Each level maps to:

| Level | Plates | Viewing time | Sizes |
|-------|--------|--------------|-------|
| 1 | 1 | 6 s | all normal |
| 2 | 1 | 4 s | all normal |
| 3 | 2 | 8 s | all normal |
| 4 | 2 | 6 s | mixed (75–125%) |
| 5 | 3 | 9 s | mixed |
| 6 | 3 | 7 s | mixed |
| 7 | 4 | 10 s | mixed (60–140%) |
| 8 | 4 | 8 s | mixed (60–140%) |
| 9–12 | 5–6 | 10 → 8 s | mixed (50–150%) |

(Roughly 2–3 s per plate at the top.) A "viewing time multiplier" setting (0.5×–2×) lets players make it easier or harder overall, and an option turns off adaptive levels to train at a fixed level.

Recall details (my proposal):
- One input per plate, in the order shown (left to right, top to bottom). Typing is shown in uppercase. Spaces, hyphens and letter case are ignored.
- A round **succeeds** only when every plate is exact. Accuracy = the average per-plate alignment accuracy.
- Plates in one round never repeat a county code twice in a row and are all distinct.
- Generation follows the real rules: 42 county codes; B has 2 or 3 digits (01–99 or 100–999), others 2 digits (01–99, never 00); 3 letters with no Q; the first letter is never I or O; the reserved groups POL, DEP, SNT, SRI and GUV are excluded. Source: en.wikipedia.org/wiki/Vehicle_registration_plates_of_Romania.
- A "Country" select setting with only Romania for now (that's what makes the multi-country design visible).

## Why it matters
The level table *is* the game's difficulty curve. The recall rules decide what counts as correct.

## Answer
(manager) **Approved, with the changes below.** Spec §13 leaves exact default values to the builder, so the curve is my call. The owner can tune it after playing. No escalation needed.

**Level table.** Use the shared staircase: levels 1–12, start at 1, +1 after 3 correct in a row, −1 after a miss. Make the step values settings, as in Number Flash (spec §5.3). Rows 1–8 are as proposed. Rows 9–12 are fixed exactly, not as a range:

| Level | Plates | Viewing time | Sizes |
|-------|--------|--------------|-------|
| 9 | 5 | 10 s | 50–150% |
| 10 | 5 | 8 s | 50–150% |
| 11 | 6 | 10 s | 50–150% |
| 12 | 6 | 8 s | 50–150% |

- Keep the table as one typed constant in `logic.ts`. Add a test that the plate count never decreases as the level rises and that every level is at least as hard as the one before (more plates, or the same plates with less time per plate).
- Each plate's size is drawn from the level's range with the seeded RNG (spec §5.3). Scale relative to the container, so that 6 plates at 150% still fit at 400 px width (flex-wrap, centred). The reading order is DOM order: left to right, then top to bottom. The inputs are labelled "Plate 1…n". Plates carry no index numbers.
- **Viewing time multiplier** (0.5×–2×, step 0.25, default 1×): approved. Spec §6 says all numbers are settings. The final time is `round(levelTime × multiplier)`, and the hide moment is precise (spec §2).
- **Fixed-level option: drop it.** It isn't in the spec, and Number Flash doesn't have one. If the owner wants it, it can come later for every adaptive game at once.

**Recall and scoring.** Approved as proposed:
- One input per plate, in the order shown. The order is checked (spec §6.3, builder's call). Typing is shown in uppercase. Spaces, hyphens and case are ignored. Pass `inputmode="text"` and `autocapitalize="characters"` (add a prop to `RecallInput` if needed).
- A round succeeds only if every plate is exact, and that is what steps the staircase. Accuracy is the average of the per-plate alignment accuracies. The result screen shows a per-character diff for each plate.
- The round flow is the same as Number Flash (answer 006): the result screen, then Enter or "Next" with the 300 ms guard, and no recall time limit.

**Generation.** Approved as proposed: all plates in a round are distinct, with no county code twice in a row, 42 codes, B with 2 or 3 digits, others 2 digits (never 00), no Q, I or O never first, and the reserved groups excluded. Spec §13 asks for the rules to be researched and cited. Put the citation in a header comment in `games/plates/formats/ro.ts`. Wikipedia is acceptable. Also cite the official order (Ordinul MAI 1501/2006) if you can confirm it. Add a test that generates many plates with a fixed seed and validates each one against a regex built from the rules.

**Country select** with only Romania: approved. It's cheap, and it shows that formats are pluggable (spec §6.3).
