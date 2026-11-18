# 016 — Names & Faces module (with selectable name country)

- **Status:** answered
- **Asked by:** builder · **Date:** 2026-11-18
- **Plan / task:** plan-14 (Names & Faces), being written

## Context
The owner asked (2026-11-18): "add name and face module and make so you can select the country names (for the moment, it will be only romanian)". It's a classic memory-sport discipline (Names and Faces), trained by linking a vivid image of the name to a striking facial feature.

## Proposal
1. **Id / name:** `names-faces` / "Names & Faces". Trains: "Linking names to faces — a memorable feature + an image for the name".
2. **Faces:** original, procedurally drawn SVG faces from the seeded RNG — no photos, no external art. Features: face shape, skin tone (a diverse palette), hair style and colour, eyebrows, eyes, nose, mouth, optional glasses / beard / moustache / earrings / freckles. Each face has a presentation (`f` | `m`) that steers hair styles and facial hair, so the name can match. Faces in a round are all visibly different (no duplicate feature combination).
3. **Name sets are pluggable** like plate formats: `src/games/names-faces/names/<id>.ts` exporting `{ id, name, female: string[], male: string[], last: string[] }`, plus an `add-name-country` note in the skill docs. **Only Romanian (`ro`)** now: ~100 common female, ~100 common male first names and ~150 common surnames, with correct diacritics (Ștefan, Ioana, Popescu, Țurcanu…). Setting `country` (select built from the registry, only Romania).
4. **Setting `nameStyle`:** `first` (first names only, default) or `full` (first + last name).
5. **Round:** study phase shows all faces of the round in a grid, each with its name, for `faces × secondsPerFace` (setting 3–15 s, default 6), with **Done** to stop early (`useCountdown`; hidden tab pauses). Recall: the same faces in a **new random order**, one at a time; type the name (Enter = next; empty = skip). In `full` mode type "First Last" in one box.
6. **Matching:** case-insensitive, trims spaces, and **diacritic-insensitive** (`Stefan` = `Ștefan`, since many phone keyboards make diacritics slow); exact diacritics are shown on the result screen. In `full` mode the first and last name score separately (half a point each).
7. **Levels 1–10:** faces per round 3 · 4 · 5 · 6 · 8 · 10 · 12 · 15 · 18 · 20. Names within a round are unique (no two people share a first name; in `full` mode no repeated surname either).
8. **Scoring & progression:** accuracy = points / faces. Three zones (shared `stepThreeZone`): ≥ 90% passes (counts toward up), < 50% drops, otherwise stay. `upAfter` setting as in other games.
9. **Result screen:** each face with the right name, the player's answer, ✓ / ✗ (not colour alone).
10. **Summary:** `best level <n>` · Rounds · Most faces in a passed round · Accuracy (last 10) · Success (last 20).

## Why it matters
Defines the face generator scope, the name-data format for future countries, and the matching rule (diacritics).

## Answer
(manager) **Approved, with changes to full-name entry, matching details and face distinctness.** The owner asked for this module and prefers not to be asked, so these are my calls. Follow the `add-minigame` skill. Add a `decisions/log.md` entry and a Names & Faces section to `memory-theory.md`, and don't write `docs/names-faces/`. The round flow follows answer 006, settings are snapshotted at round start (answer 004), and all randomness goes through `createRng`.

1. **Id, name, trains: approved.**
2. **Faces: approved, with a stronger distinctness rule.** Use original SVG faces from the seeded RNG.
   - "No duplicate feature combination" isn't enough: two faces that differ only in nose shape look identical at small sizes. Any two faces in a round must differ in **at least 3 salient features**: hair style, hair colour, face shape, glasses, facial hair, skin tone and earrings. Test this over many seeds at 20 faces.
   - Skin, hair and eye palettes are **content data** in the generator file, not UI tokens. That's the one allowed exception to "colours come from tokens", and the file should say so in a comment. The face background and card chrome still use tokens.
   - Faces are decorative in the DOM (`aria-hidden`), with a short text description for screen readers (e.g. "short red hair, glasses").
3. **Pluggable name sets: approved, like plate formats.** Use `names/<id>.ts` with `{ id, name, female, male, last }`, a small registry, and a `country` select built from it.
   - Add `.claude/skills/add-name-country/SKILL.md`, mirroring `add-plate-country`, and a pointer to it in CLAUDE.md.
   - Romanian list: cite the source in a header comment (e.g. INS / evidența persoanelor frequency lists, or Wikipedia). Use comma-below `ș ț`, never cedilla `ş ţ`.
   - Tests: no duplicates **after accent folding** within each list, every entry is NFC, and a female/male first name used by both lists appears in only one of them.
4. **`nameStyle` `first` (default) or `full`: approved.** In `full` mode, no surname repeats within a round.
5. **Study phase: approved** (grid of faces with names, `faces × secondsPerFace` with 3–15 s and default 6, Done to stop early, `useCountdown`). The grid may scroll at 400 px for large levels; the time is generous enough. **Recall: approved, with two changes:**
   - **Full mode uses two inputs (First, Last)**, not one box. Splitting "First Last" breaks on compound names like "Ana Maria" or "Popescu-Tăriceanu". Enter moves from First to Last, then to the next face.
   - Add a **Back** button so typos on the previous face can be fixed before the final **Check**. Empty Enter skips, and the shared held-Enter guard applies.
6. **Matching: approved as diacritic-insensitive.** It's a fairness call about slow phone keyboards. It doesn't conflict with spec §2, because the stored and displayed text is never changed. Exact rule, as a pure tested function: NFC → NFD → strip `\p{M}` → lowercase (`toLocaleLowerCase('ro')`) → treat hyphens as spaces → collapse whitespace → trim.
   - This folds both `ş` and `ș` to `s`.
   - No typo tolerance beyond that: `Stefn` is wrong.
   - The result screen shows the exact name with its diacritics, and for wrong answers a `ResultDiff` of the expected name against the player's answer.
   - In full mode, the first and last names are worth half a point each, as proposed.
7. **Levels 1–10 (3 … 20 faces): approved.** Keep them in a typed constant with a test that the count strictly increases. Names are unique per round as proposed.
8. **Scoring: approved.** `accuracy = points / faces`, using the shared `stepThreeZone` (≥ 90% passes, < 50% drops), with the `upAfter` setting. `success` = the pass zone. `metrics: { faces, points, fullNames: 0|1 }`.
9. **Result screen: approved.** ✓ or ✗ plus the text, not colour alone.
10. **Summary: approved.**

**Your FYIs:** I don't object to the Quick Math targets based on per-operation seconds per problem averaged over the enabled operations. It does what answer 015 asked (targets that track difficulty) and does it better for mixed operations. The owner's Memory Grid change (4×4–13×13, 20 levels) overrides answer 015 point 2. Keep the "no level easier than the one before" test, and check that 13×13 still has tappable cells at 400 px, or that the layout scrolls.
