---
name: add-plate-country
description: Use when adding a new country's license plate format to the MemorizeThis License Plates game
---

# Add a license plate country

Countries are pluggable. One file implements `PlateFormat` (`src/games/plates/formats/types.ts`). **Worked example: `src/games/plates/formats/ro.ts`** (Romania).

## 1. Research the real rules, and cite them

Find an authoritative source (the country's Wikipedia "Vehicle registration plates of …" page is a good start). Write down:
- the layout (segments and their order), e.g. `CC 12 ABC`
- the region or county codes, if any (the complete list)
- the digit rules (lengths, ranges, forbidden values such as `00`)
- the letter rules (forbidden letters, forbidden first letters, reserved or obscene groups)
- the look: background and character colors, the band (EU blue + country code, a flag, or none), the font, and the plate's width:height

Put the source URL and quoted rules in the file's top comment. If a rule is unclear, write a question file in `docs/agents/questions/` and ask the manager agent.

## 2. Branch and write the rules test first

```bash
git switch -c feat/plates-<id>
```

Create `src/games/plates/formats/<id>.test.ts`, modeled on `ro.test.ts`:
- the code list has the right length and no duplicates
- **2000 plates from `createRng(seed)` obey every rule.** Collect the violations into an array and `expect(violations).toEqual([])` (no conditional `expect`, which lint forbids)
- `isValid` rejects one example per broken rule and accepts real examples

Run it and watch it fail.

## 3. Implement `src/games/plates/formats/<id>.ts`

Export `const <id>: PlateFormat` with:
- `id` (a lowercase ISO code, e.g. `'md'`) and `name` (English, e.g. `'Moldova'`)
- `generate(rng)`, which uses ONLY the `Rng` it's given (never `Math.random`) and returns `{ country: id, segments, text: segments.join(' ') }`
- `isValid(text)`
- `style` (real-world colors live here, not in theme tokens). Set `bandStars: false` when there is no EU band.

## 4. Register it

Add it to `plateFormats` in `src/games/plates/formats/index.ts`. The game's **Country** setting picks it up automatically. Extend the `is registered` test in `ro.test.ts`, or add the same check to your test.

## 5. Check the look, verify, push

- If the plate needs something `PlateView.vue` can't draw (two rows, a flag band, a different band position), extend `PlateStyle` and `PlateView` in a backwards-compatible way and add a test.
- `npx vitest run && npm run type-check && npm run lint && npm run build && npm run format`, all green.
- Commit and `git push -u origin feat/plates-<id>`. Never push to `main`.
