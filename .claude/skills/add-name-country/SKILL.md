---
name: add-name-country
description: Use when adding a new country's names (first and last names) to the MemorizeThis Names & Faces game
---

# Add a name country to Names & Faces

Name sets are pluggable: one file per country implementing `NameSet` (`src/games/names-faces/names/types.ts`). **Worked example: `src/games/names-faces/names/ro.ts`** (Romania).

## 1. Collect the names, and cite where they come from
- At least 20 names per list (the biggest round has 20 faces, and names never repeat within a round). Aim for about 100 common **female** first names, about 100 common **male** first names, and about 150 common **surnames**.
- Use the language's correct spelling and diacritics, in UTF-8 and NFC. For Romanian that means comma-below `ș ț`, never cedilla `ş ţ`.
- Put the source in the file's top comment (an official frequency list, or Wikipedia "<Country> name" / "Most common surnames").
- **No name may appear in both the female and male lists after accent folding.** Players type without diacritics (`foldName` in `logic.ts`), so `Viorica` and `Viorică` would clash. Keep **one spelling per surname** (not both `Sîrbu` and `Sârbu`), or a correct answer would be marked wrong.

## 2. Branch and test first
`git switch -c feat/names-<id>`, then copy `names/ro.test.ts` to `names/<id>.test.ts`:
- each list has no duplicates after `foldName`;
- every entry is NFC with no surrounding spaces;
- no folded name is in both first-name lists;
- add language-specific checks, like the cedilla check for Romanian.

Run the tests and watch them fail.

## 3. Implement and register
- Create `names/<id>.ts` exporting `const <id>: NameSet = { id, name, female, male, last }`. `name` is the country's English name, shown in the settings.
- Add it to `nameSets` in `names/index.ts`. The game's **Names from** setting picks it up automatically.

## 4. Verify and push
`npx vitest run && npm run type-check && npm run lint && npm run build && npm run format`, all green. Then push the branch; never push to `main`.
