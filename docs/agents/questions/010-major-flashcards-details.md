# 010 — Major System Flashcards: scheduling, import conflicts, picking cards

- **Status:** open
- **Asked by:** builder · **Date:** 2026-11-10
- **Plan / task:** plan-6 (Major System Flashcards), being written

## Question
Spec §6.6 is detailed. These points are still open. Proposals:

1. **Box system is per session, not calendar-based.** 5 boxes. "Knew it" moves the card up one box (max 5). "Didn't" sends it back to box 1. There are no due dates: the app is for drilling, possibly for hours. The **smart order** is a priority queue. Each card's priority is its box (lower comes first), with ties broken by "least recently seen". A missed card is also **reinserted 3 cards later** in the same session (or at the end if fewer remain). A session is endless: it keeps drawing until the player stops, and the screen shows "cards this session / known / missed".
2. **Shuffle mode:** every card once in random order, then a summary, then "Again" reshuffles. Box updates still apply in shuffle mode, so progress counts everywhere.
3. **Pick mode:** a checklist of the deck's cards with "Select all / none" and a **range box** that accepts `30-49`, `00-09, 15, 77`. Ranges match card **inputs** as text, numerically when both ends are numbers (so `5-12` covers `05`…`12` if the inputs are zero-padded). Then the player chooses smart or shuffle order for the picked subset.
4. **Reverse:** a per-study-session toggle ("Show words → recall numbers"). Boxes are tracked **separately per direction**, because knowing 03→zeama doesn't imply zeama→03.
5. **Import conflicts:** if an imported `input` already exists in the deck, offer **"Replace existing" / "Keep existing" / "Cancel"** in the import preview. Within one file, duplicate inputs are reported as errors with line numbers (the import is blocked until the file is fixed). An import always shows a **preview** (N new, M changed, errors) before anything is written.
6. **Import formats:** CSV (`input,output`, optional header detected when the first row is literally `input,output` in any case, RFC 4180 quoting, `,` or `;` delimiter auto-detected), JSON `[{ "input", "output" }]`, and the paste box (` - `, `,`, `;`, or tab per line). Empty lines are skipped, cells trimmed, NFC-normalized, UTF-8 BOM stripped.
7. **Export:** CSV (always `,`, with a header row, quoted when needed, UTF-8 **with BOM** so Excel opens diacritics correctly) and JSON (pretty-printed). Card progress isn't exported here (that's the full Backup's job).
8. **Starter deck:** none is bundled (the owner's list is personal). The empty state explains the format with the example `00 - sos … 05 - solz` and offers the paste box.
9. **Stats per deck:** known well = box ≥ 4; success rate = knew / (knew + didn't) over all answers; weakest = the 10 cards with the lowest success rate (at least 3 answers), ties by fewer answers. Session time counts in the session tracker under the id `major`.
10. **Where it lives:** its own route `/major` (not a GameModule, because it isn't a timed round game), linked from Home as a tile styled like the games, and from the Stats page later.

## Why it matters
1, 4 and 5 shape the data model (box per direction, conflict handling). 3 is the main UI decision for picking cards.

## Answer
