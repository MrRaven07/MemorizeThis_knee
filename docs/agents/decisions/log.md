# Decision log

Short, dated entries: what was decided, and why. Add newest at the bottom.

## 2026-11-10

- **Rewrite with Vue 3 + TypeScript + Vite.** The owner wants to learn Vue. TypeScript was chosen because job listings ask for it. The old HTML/JS mockup was removed.
- **Pinia, Vue Router, Vitest, ESLint + Prettier (+ oxlint from create-vue).** The mainstream, official choices, and the easiest to learn from.
- **Hash routing + Vite `base: './'`.** The build works from any path, including a Capacitor WebView for Android later.
- **Synchronous `StorageAdapter` over localStorage.** Simple to use from stores. localStorage works inside Capacitor's WebView. Revisit (async adapter) if moving to Capacitor Preferences or IndexedDB.
- **Versioned storage with migrations; corrupt values kept under `<key>.corrupt`.** Anti-goal: never lose player data.
- **Backup/restore replaces all data, after validation and an in-page confirmation** (questions/003).
- **Alignment scoring (Levenshtein) for typed recall.** One skipped digit costs one digit (the old mockup marked everything after it wrong).
- **Adaptive staircase** shared by the games that have a size knob.
- **`useCountdown` measures against `performance.now()`, drives display by `requestAnimationFrame`, and pauses on a hidden tab.** Exposure time must be exact.
- **Session time uses wall-clock `Date.now()` and the open session is saved continuously** (questions/002). Closing the tab loses nothing. A session ends after 30 idle minutes.
- **Games snapshot settings per round** (questions/004). **Esc precedence: the game first, via `preventDefault`** (questions/001).
- **Dark-only "Dark focus" theme via CSS tokens.** The owner picked it from mockups. A visual polish pass comes later.
- **GPL-3.0** license.
- **Builder questions go to a manager agent and are logged in `docs/agents/questions/`.** The owner's request.
- **Game keyboard handling: `useGameKeys` on `document`** (2026-11-10, after the final review). Fixes Esc quitting mid-round and Enter in the settings drawer starting a round.

## 2026-11-11

- **Deck Memory, an out-of-spec module.** The owner instructed: once the spec's modules are done, add another module "with playing cards", with no questions to them (route questions to the manager). The manager ruled on the design (questions/012): Speed Cards-style deck memorization, a picker plus typed codes for recall, and a 4→52 card staircase.
- **`alignSequences<T>`** generalizes alignment scoring to any items (cards). `alignStrings` is a wrapper with unchanged behaviour.
- **Schema v2:** sessions count flashcard answers (`cards`), via a real migration (questions/011).
- **Smart scheduler amended** (questions/013): no card within the last 3 draws; at most 3 forced returns in a row, so always-missed cards can't starve the rest.

