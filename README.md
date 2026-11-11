# MemorizeThis_knee
A memory gym: minigames to train memory palace / art of memory techniques. Built with Vue 3 + TypeScript.



## Run it

You need [Node.js](https://nodejs.org/) 22.18+ or 24.12+.

```bash
git clone https://github.com/MrRaven07/MemorizeThis_knee.git
cd MemorizeThis_knee
npm install
npm run dev        # open the printed URL in your browser
```

Other commands:

```bash
npm run test:unit  # run the tests (watch mode; add -- --run for a single run)
npm run build      # production build into dist/
npm run lint       # lint and auto-fix
```

## Roadmap

- [x] Skeleton (vibe-coded mockup, 01/10/2026)
- [x] Rewrite: Vue 3 + TypeScript foundation (shared timer, scoring, difficulty, storage, sessions)
- [x] **Long Number** — memorize one long number, then type it back
- [x] **Number Flash** — a short number flashes, gets longer as you improve
- [x] **License Plates** — memorize realistic plates (Romania first)
- [x] **Maze** — memorize a maze with spikes, then type the route (WASD / 1234)
- [x] **Card Match** — find the pairs in the fewest moves
- [x] **Major System Flashcards** — your own number→word decks (CSV/JSON import)
- [x] Stats page and session summary (day streak, time per game, daily trend lines)
- [ ] Android app (Capacitor)
- [ ] Logo and visual polish

## Flashcard file format

Decks can be imported (and exported) as CSV, JSON or pasted text, in any language (UTF-8).

**Paste**: one pair per line, separated by ` - `, a tab, `;` or `,` (the first one found):

```
00 - sos
01 - sat
02 - sanie
```

**CSV**: two columns, an optional `input,output` header, `,` or `;` as separator, quotes for values with commas:

```csv
input,output
00,sos
01,"sat, mare"
```

**JSON**: a list of objects; both values must be text (in quotes, so `00` stays `00`):

```json
[
  { "input": "00", "output": "sos" },
  { "input": "01", "output": "sat" }
]
```

Every import shows a preview first; any error (with its line number) blocks the import, so nothing half-imported is ever saved. Study in either direction (number → word or word → number).

### Logs

- 01/10/2026 22:53PM I **_vibe coded_** the entire app just to make it work as i needed it quick. I will not leave it like this, at least from a frontend point of view.


### AI usage

I've used AI here, just to make sure that the small project can be realised very quickly to use it as fast as possible. The reason for the work "knee" is because the purpose of the project is not to be impressive from a Computer-Science point of view for the moment.






### License

Copyright (C) 2026 Corbu Mircea-Florin

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. See [LICENSE](LICENSE) for the full text.
