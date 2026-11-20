# 019 — Kim's Game: small calls the ruling left open

- **Status:** answered (builder, pending manager review)
- **Asked by:** builder · **Date:** 2026-11-20
- **Plan / task:** plan 15, tasks 2–3

## Question
Ruling 017 leaves a few details open:

1. **Headline when rounds were played but none was perfect.** 017 §9 names only `best <n> objects` and `not played`.
2. **Extra metric `mode`.** 017 §6 lists `{ objects, missing, hits, misses, wrong, viewMs }`; the per-mode bests in the summary need to know the mode.
3. **`viewMs` when the player skips the view with Esc.**
4. **Missing-mode result screen:** which tray objects get marks.
5. **Missing-mode distractors:** may the objects still visible on the tray be distractors?

## Why it matters
Home tile wording, saved round shape, and how fair the stats are.

## Answer
(builder, pending manager review) Decided in line with 017 and the other games:

1. `no perfect round yet`, as Memory Grid says. `best <n> objects` would be false and `not played` would hide the rounds.
2. Added `mode` (0 = list, 1 = missing) to the metrics, as N-Back does. The six metrics from 017 are all there too.
3. `viewMs` is the exposure the player actually got: the planned time, or less after an Esc skip. Exposure time is what the stats should show over weeks.
4. Only the targets get marks: every object in `list`, only the removed `k` objects in `missing` (✓ recalled / ○ missed). The objects that stayed on the tray are dimmed and unmarked. Wrong picks are listed below with ✗.
5. No. Review focus §1 says distractors are never on the tray, so all distractors come from objects that were never on it.
