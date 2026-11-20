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

## 2026-11-18

- **N-Back module** (owner's choice from the module ideas list). Rules in questions/014: accuracy = hits / (hits + misses + false alarms) so not pressing scores 0; three zones (≥80% counts up, <50% drops N, otherwise stay); a separate level per mode (`n-back:<mode>`); exactly 6 targets per stream; drift-free timing from one countdown.
- **Memory Grid** (owner's idea): 12-level pattern curve, view 1 s + 0.15 s per lit cell, exact copy passes, accuracy hits/(hits+misses+wrong) (questions/015).
- **Quick Math** (owner's idea): timed sprint, exact non-negative answers, per-level target per minute, three zones (≥90% + target passes, <60% drops); the three-zone step moved to `core/difficulty` (questions/015).
- **Memory Grid range changed by the owner:** 4×4 up to 13×13 over 20 levels (questions/015, owner decision).
- **Quick Math targets per operation** (review finding): each level has a typical time per problem for each operation, and the pass target is sprint ÷ the average over the *enabled* operations (rounded, min 1), so ×-only sprints aren't impossible and +-only ones aren't trivial. With all operations on, it stays close to 015's 20 → 6 per minute.

## 2026-11-20

- **Sequence module** (owner's idea, Simon-style; generic name only). Rules in questions/018: one run = one growing sequence = one `RoundResult` (`level`/`accuracy` null, `success` = ties or beats the previous best for the same pad count); the sequence is drawn lazily from the seeded RNG, append-only, capped at 999; item time `max(250, baseMs − 15 × (step − 1))`, gap 30%, after a 600 ms dark lead-in, with the current item worked out from one countdown per playback (no drift at step 300). Builder calls in questions/030: the second Esc ends and records the run (a third Esc quits), "Keep going" replays the step, a 1 s timeout becomes 2 s, "Total items recalled" counts every item repeated over completed steps.
- **Small core addition: `src/core/audio/tones.ts`** (pre-approved by questions/018). Web Audio tones: `AudioContext` created only in `unlock()` from a user gesture, C-major pentatonic per pad, 10 ms fades, a low square buzz for mistakes, silent when audio is missing or fails. Games that want sound use it; tests mock it.
- **Pad colour tokens `--pad-1`…`--pad-9`** in `tokens.css`. The 4-pad set is purple/cyan/orange/pink, not the toy's red/green/blue/yellow. Every pad also shows a number and a shape.
