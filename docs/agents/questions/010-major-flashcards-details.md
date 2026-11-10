# 010 — Major System Flashcards: scheduling, import conflicts, picking cards

- **Status:** answered
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
(manager) **Approved, with one change to the scheduler (point 1) and several clarifications.** Spec §6.6 marks the box system as a builder's call and §13 leaves the details open, so these are my calls. They protect the player's data and the spec's intent. No escalation needed.

1. **Box system: approved, but strict "lowest box first" is changed.** With strict box priority, box-5 cards never come back while any box-1 card exists, so in a 100-card deck the known cards would effectively disappear. Spec §6.6 says known cards come back "less often", not never. Use a deterministic **overdue score** instead (a pure function in `features/major/`, fully tested):
   - Keep a session tick that counts cards shown. Each box has an interval, `[1, 3, 9, 27, 81]` for boxes 1–5.
   - `overdue = (tick − lastSeenTick + 1) / interval[box]`. Show the card with the highest score. Break ties by box (lower first), then by deck order.
   - A card not yet seen this session counts as last seen one interval before the session started. Box 1 comes first, and each box then shows up in proportion to 1 / interval.
   - A missed card is still forced back after exactly 3 other cards (at the end of the queue if fewer remain). This override wins over the score.
   - Boxes, answer counts and last-seen times **persist across sessions**. Only the scheduling is session-based; there are no calendar due dates. New cards start in box 1. The endless session and the "this session / known / missed" counter are approved.
   - Tests: no card starves, box-5 cards appear less often than box-1 cards, a missed card returns after exactly 3 others, and the order is deterministic for a fixed state.
2. **Shuffle mode: approved.** Each card once, in an order from `createRng`, then a summary, then "Again". Box updates apply in every mode.
3. **Pick mode: approved, with a precise range rule.** Major decks often hold both `0`–`9` and `00`–`99`, so `0-9` must not also match `00`–`09`:
   - When both range ends are digit strings **of the same length**, match only digit-string inputs of that length within the numeric range. `00-09` matches `00`…`09`, and `0-9` matches `0`…`9`.
   - When the ends differ in length (`5-12`), match digit-string inputs of any length numerically.
   - A single item (`15`, or a word) matches an input exactly (after NFC and trim).
   - Show invalid items and items that match nothing inline, next to the box. Never ignore them silently.
4. **Reverse: approved.** Progress is tracked separately per direction. Key it by a stable card `id` (`crypto.randomUUID()`), never by the input text. Editing a card, or replacing it on import, **keeps** its progress; it's the player's history, and typo fixes are the common case.
5. **Import conflicts: approved.** Replace existing, Keep existing, or Cancel, with a preview that shows N new, M changed and the errors before anything is written. Inputs are compared after trim and NFC, case-sensitively. **Any** error (a duplicate within the file, an empty value, a malformed line or row) blocks the import, and every error is listed with its line number (spec §6.6: no silent skipping). The paste box lets the player fix the input and try again.
6. **Formats: approved, with these details:**
   - CSV delimiter: use whichever of `,` or `;` splits the first data line into exactly 2 fields outside quotes. If that's ambiguous, report it as an error.
   - Paste-box separators: pick the first one present in the order tab > ` - ` > `;` > `,`, and split at its **first** occurrence, so the output may contain the other characters.
   - JSON: `input` and `output` must be strings. Report numbers as errors and never coerce them, because `00` would become `0`.
   - Line numbers are 1-based and count every line of the original text, including the header and blank lines.
7. **Export: approved.** CSV with `,`, a header row, quoting as needed and a UTF-8 BOM. JSON pretty-printed. No progress included. Downloads use the same Blob method as Backup. Add a round-trip test (export, then import, with diacritics and commas inside the values) as spec §12 requires.
8. **No bundled starter deck: approved.** The empty state shows the example and the paste box.
9. **Stats: approved, per direction.** The deck stats screen has the same direction toggle. Session time is counted under `major` with `beginActivity('major')`, but only while the study screen is mounted, not while managing decks or importing (spec §7). A card answer does not call `noteRound`. Cards answered are stored separately, and plan 7 decides how they appear in the session summary.
10. **Own `/major` route, not a GameModule: approved.** It matches spec §5.1 (`features/major/`, a Major view) and §9 (a Home entry for Major System).

Data: decks get a new key (e.g. `mt:decks`), so the full Backup includes them automatically. A brand-new key with a `loadJson` fallback needs no migration. Bump `SCHEMA_VERSION` only if an existing shape changes. Save after every change, because decks are the player's own work (spec §8).
