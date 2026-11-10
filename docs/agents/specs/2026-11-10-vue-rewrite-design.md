# MemorizeThis — Vue rewrite design

Date: 2026-11-10
Status: draft, waiting for the owner's approval

Notes in this document marked **(builder's call)** are decisions made by the designer (Claude), not by the owner. Everything else was decided by the owner during brainstorming.

---

## 1. Intent

MemorizeThis is a memory gym. A player opens it to train the memory techniques they already use in their head (memory palace, the Major System, the art of memory in general) through several short minigames. They can play for 10 minutes or for hours. After a session, their short- and medium-term memory should be noticeably sharper, and over weeks the stats should show them getting better.

The owner is building it for themselves, but anyone should be able to clone it and play. The current code is a quick, AI-generated mockup of one game. It is replaced entirely. It serves only as a reference for the "Long Number" game.

The owner also wants to **learn Vue** through this project, so the code should be idiomatic, readable Vue 3 that a learner can follow, not clever or over-abstracted.

### Who plays

- The owner first; anyone after that.
- Expected users: Romanian and English speakers, possibly others.
- The **memory palace lives only in the player's head**. The app never models a palace (no rooms or loci inside the app). It supplies the material to memorize and checks the recall.

## 2. Goals, non-goals, anti-goals

**Goals**
- Six playable modules on day one (section 6).
- Every minigame is a **module** plugged into a shared core. Timers, difficulty steps, scoring, results, stats and storage are written once.
- Adaptive difficulty wherever it makes sense, so the player always trains at their own limit.
- Statistics for each module and for all games combined, including time spent playing.
- Runs on the web now and can become an Android app later from the **same codebase**.
- Agent-friendly: a `CLAUDE.md`, project skills and a `docs/agents/` folder, so future Claude agents can extend it safely.

**Non-goals (for now)**
- No accounts, no server, no online leaderboards. All data stays on the device.
- No Android build yet. Just don't block it.
- No light theme yet.
- No modelling of the memory palace inside the app.
- No final visual polish. Hand-crafted UX polish comes in a later pass.

**Anti-goals (would make it a failure even if it technically works)**
- Inaccurate timing. A "1 second flash" that actually lasts 1.3 s ruins the training. Display times must be precise.
- Unfair scoring, like the old mockup, where one skipped digit marked everything after it wrong.
- Losing the player's data (Major System decks, stats) through an update or an innocent mistake.
- Mangling non-English text: Romanian diacritics (ă â î ș ț) and any other UTF-8 must survive typing, importing, storing and exporting.
- Adding a game requires editing core code in many places.
- A generic "AI-made" look. The current dark direction is accepted for now, and polish is deferred, but avoid stock-template feel where it's cheap to.

## 3. Constraints

- **Vue 3 + TypeScript + Vite.** TypeScript was chosen because job listings ask for it.
- Player setup: `git clone` → `npm install` → `npm run dev`. Also `npm run build` for a static production build.
- **English UI.** All user input and data is UTF-8.
- **Dark theme only**, in the "Dark focus" direction the owner picked from mockups: near-black background, monospace digits, one bright green accent, thin borders, low distraction.
- **Mobile-first and touch-friendly**, and also fully keyboard-playable on desktop.
- **Android later via Capacitor.** So: relative asset paths, no reliance on browser-only APIs without a fallback, storage behind an adapter (section 8).
- **License: GPL-3.0** (already applied in `LICENSE` and `README.md`).
- Local environment: Node 26, npm 12.

## 4. Tech stack

Decided by the owner: Vue 3, TypeScript, Vite, npm.

**(builder's call)**, all mainstream choices that fit a learning project:
- **Vue Router** for pages.
- **Pinia** for shared state (settings, stats, session, decks).
- **Vitest** + Vue Test Utils for tests.
- **ESLint + Prettier** with the official Vue/TS configs.
- TypeScript `strict` mode.
- No UI component library. Plain scoped CSS with CSS custom properties (design tokens), which keeps it light and fully customizable.

## 5. Architecture

### 5.1 Shape

```
src/
  core/            shared logic written once (no Vue imports where possible)
    timing/        precise timers (performance.now + requestAnimationFrame)
    difficulty/    adaptive "staircase" (N right in a row → harder, wrong → easier)
    scoring/       sequence alignment scoring for typed recall
    random/        seedable RNG (so logic can be tested deterministically)
    storage/       storage adapter + versioned schema + migrations
    session/       active-play-time tracking
  games/
    registry.ts    the list of game modules — the only place a new game is registered
    long-number/   one folder per game: index.ts (module definition), logic.ts,
    number-flash/  logic.test.ts, settings, and its Vue component(s)
    plates/        + plates/formats/ro.ts (one file per country)
    maze/
    card-match/
  features/
    major/         Major System decks, import/export, scheduler, flashcard UI
  stores/          Pinia stores: settings, stats, session, decks
  components/      shared UI: GameShell, TimerBar, RecallInput, ResultDiff, SettingsForm, …
  views/           Home, GameView (hosts any module), Major, Stats, Settings
  router/
  styles/          tokens.css (colors, spacing, type), base.css
```

### 5.2 The game module contract

Every game exports one module definition that the registry lists. Roughly (exact typing is the builder's call):

- `id`, `name`, short `description`, and the memory skill it trains (shown in the menu).
- `defaultSettings` plus a description of its settings, so the shared settings form can render them.
- Its Vue component, lazy-loaded.
- How to summarize a finished round for stats: level reached, success or failure, accuracy, duration, plus any game-specific metrics.

The shared `GameShell` provides the session clock, level indicator, quit and settings buttons, and the results screen. The game provides the play area. A round reports its result through one shared function that writes stats. Games never touch storage directly.

### 5.3 Shared core pieces

- **Precise timing.** Durations are measured with `performance.now()` and displays are driven by `requestAnimationFrame`. The "hide" moment must be accurate to a frame. Timers pause correctly if the tab is hidden (**builder's call:** a round in progress is paused when the tab is hidden).
- **Round phases.** Most games go *memorize → (optional delay) → recall → result*. A small shared phase helper avoids every game re-implementing it.
- **Adaptive difficulty ("staircase").** Configurable: how many correct answers in a row raise the level, how much it rises, how many misses lower it, and the minimum and maximum. Used by Number Flash, Plates, Maze and Card Match. The current level for each game is saved, so the next session resumes where you left off.
- **Sequence scoring.** Typed answers are compared with the target using an alignment (Levenshtein-style), so a missed or extra character only costs that character. The results screen shows the per-character diff: correct, wrong, missing and extra.
- **Seedable RNG.** All generation (digits, plates, mazes, card layouts) goes through it, so tests can check exact outputs.

## 6. The modules

Defaults below are starting points. All numbers are settings unless said otherwise.

### 6.1 Long Number (the current mockup, done properly)
- Shows one long number, or several numbers joined together. Settings: number of groups, digits per group, whether to visually separate groups.
- Phases: memorize (time limit set by the player, with a "skip" button to go early), optional wait, then recall. The recall time limit is optional.
- Scoring: alignment scoring (5.3) with a per-digit diff and an accuracy percentage.
- Not adaptive. The player sets the size. Stats track the longest number recalled 100% correctly and accuracy over time.

### 6.2 Number Flash
- Starts at **4 digits**. Digits appear **gradually**, one after another. The full number stays visible until **4 s** after the round started, then hides and the player types it.
- After **3–5 correct answers in a row** (setting, default 3) the length goes up by **1–2** (setting, default 1). A wrong answer makes it shorter. **(builder's call:** each wrong answer is −1 digit, minimum 3, and the streak resets.)
- Settings: reveal mode (gradual or all at once), reveal speed, total display time, the streak and step values.
- **(builder's call)** The display time grows with length so long numbers stay possible: 4 s for 4 digits, plus a setting-controlled amount per extra digit (default +0.5 s). Setting the extra to 0 keeps it fixed at 4 s.
- Stats: highest length reached, current length, accuracy.

### 6.3 License Plates
- Shows one or more realistic plates drawn in CSS (the plate itself only: no car, no photos), then the player retypes them. Spaces and letter case are ignored when checking.
- **Country formats are pluggable**: one file per country under `games/plates/formats/` that knows how to generate a valid plate and how to draw it (colors, band, layout). **Only Romania is implemented.**
- **Romania (to verify against the official rules while building):** white plate with the blue EU band and "RO"; county code + digits + 3 letters, e.g. `B 505 LSK`, `MM 123 ABC`, `CJ 07 XYZ`. Bucharest (`B`) uses 2 or 3 digits; other counties use 2. Use the real list of county codes and the real letter restrictions (for example, which letters can't be used or can't start the group).
- Difficulty goes up by showing **several plates at once**, at **different sizes** (closer and farther, like real life), and with less viewing time. **Slight tilt/perspective is a stretch goal**, after everything else works.
- Recall: one input per plate, in the order shown. **(builder's call:** the order is checked; scoring is per plate, with a per-character diff.)

### 6.4 Maze
- A grid of cells: **open, wall, spike, start, end**. Spikes are 1×1 cells placed on open corridors, drawn as spikes so they read as traps. Behaviorally they are walls.
- The whole maze shows for a few seconds (setting), then disappears.
- The player types the full route as one string using the key set chosen in settings:
  - **WASD:** `w` up, `a` left, `s` down, `d` right.
  - **1234:** `1` up, `2` left, `3` down, `4` right.
- Checking: the route is simulated step by step from the start. **Stepping into a wall, a spike or off the grid loses the round.** Reaching the end wins. **(builder's call:** moves after reaching the end are ignored; finishing anywhere other than the end loses; a bonus is given if the route is also a shortest route.)
- After submitting, the maze is shown again with the typed route animated over it, so the player sees exactly where they went wrong. **(builder's call)**
- While typing, the maze stays hidden. The typed moves are shown as arrows so typos are visible. **(builder's call)**
- Generation must guarantee **at least one valid path** from start to end after spikes are placed (verify with a search, and regenerate if needed).
- Difficulty: the grid grows (starting small, e.g. 5×5) and spike count rises, using the shared staircase.
- Stats: largest maze solved, win rate, how often the route was the shortest.

### 6.5 Card Match
- The classic pairs game on a grid of face-down cards.
- Optional preview: all cards are shown face-up for a few seconds before the round (setting; **0 means no preview**).
- A *move* is flipping two cards. The score is compared with the **fewest moves possible** (= number of pairs).
- **(builder's call)** Also count **memory mistakes**: mismatches where the player had already seen where the matching card was. This separates forgetting from bad luck, which matters most when there is no preview.
- Card faces: a clean set of distinct simple symbols (original SVGs or a permissively licensed icon set compatible with GPL-3.0). **(builder's call)**
- Difficulty: the grid grows (e.g. 2×3 → 3×4 → 4×4 → 4×5 → 6×6) using the staircase.
- Stats: moves above the minimum, memory mistakes, time, largest grid cleared.

### 6.6 Major System Flashcards
The player's own `input → output` cards (e.g. `00 → sos`, `01 → sat`, `02 → sanie`, `03 → zeama`, `04 → sare`, `05 → solz`), in any language.

- **Decks:** keep several decks (e.g. "Major 00–99 RO", "Major EN"). Create, rename and delete decks; add, edit and delete single cards in the app.
- **Import:** a standard file format, UTF-8:
  - **CSV:** two columns, `input,output`, with an optional header row and standard CSV quoting (commas inside quotes, etc.).
  - **JSON:** an array of `{ "input": "...", "output": "..." }`.
  - **(builder's call)** A paste box that also accepts one pair per line separated by ` - `, `,`, `;` or a tab, because that's how the owner keeps their list today (`00 - sos`).
  - Import reports problems clearly (line number, empty values, duplicates) instead of silently skipping. A UTF-8 BOM is tolerated.
- **Export:** a deck back to CSV and JSON in the same format.
- **Reverse:** any deck can be studied reversed (show the output, recall the input).
- **Study flow:** the card shows the prompt, the player recalls the answer **in their head**, flips the card, and marks **"Knew it"** or **"Didn't"**. Nothing is typed or auto-checked.
- **Modes:**
  - **Smart (priority queue):** missed cards come back sooner, known cards less often. **(builder's call:** a box system with 5 boxes, where knowing a card moves it up a box and missing it sends it back to box 1. A missed card is also reinserted a few cards later in the same session. Lower boxes have higher priority.)
  - **Shuffle everything:** all cards in random order.
  - **Pick cards:** the player selects specific cards (or a range like 30–49) and studies only those, using smart or shuffle order.
- **Stats per deck:** how well each card is known (box level), success rate per card and for the deck, and a **weakest cards** list.

## 7. Sessions and statistics

- **Session clock:** counts **up** from the moment the player starts playing, with no limit and no forced end. It's visible in the game shell. The player can press **End session** for a summary: time played, games played, rounds, levels reached, and a comparison with the previous session. **(builder's call:** a session also ends on its own after 30 minutes of inactivity. Time counts only while a game or flashcard round is on screen and the tab is visible, not on menus.)
- **Stats page:** each module's own stats (listed in section 6) plus combined totals: total training time, time per game, sessions, rounds. **(builder's call:** start with clear numbers and simple trend lines. Fancier charts come later.)

## 8. Data and storage

- All data is local: settings, per-game levels, round history, sessions, Major decks and card progress.
- Saving goes through a **storage adapter** (`core/storage`). It uses `localStorage` (or IndexedDB if history gets large, builder's call) now, and can switch to Capacitor storage on Android without touching games or stores.
- The data has a **schema version**, and migrations run on load, so updates never wipe data (anti-goal).
- **(builder's call)** A "Backup / Restore all data" button in Settings that exports and imports everything as one JSON file. Browser storage can be cleared by accident, and the Major decks are the player's own work.

## 9. UI and UX

- Dark focus theme as described in section 3, defined as design tokens in `styles/tokens.css`, so the later polish pass changes tokens rather than components.
- Home: a grid of game tiles, each showing the game name and current level or best result, plus entries for Major System, Stats and Settings. The session clock appears once a session is running.
- Inputs: numeric games use `inputmode="numeric"` so phones open the number keyboard. Enter submits, Esc quits or skips. Every game is fully playable by keyboard on desktop and by touch on a phone.
- The Maze on touch devices **(builder's call):** a small on-screen pad with the four directions, labelled with the chosen key set, since phones have no WASD.
- Respect `prefers-reduced-motion` for animations.

## 10. Agent support files

- **`CLAUDE.md`** (root): what the project is and why, how to run, test, lint and build it, the folder layout, conventions (TS strict, English UI, UTF-8, no direct storage access from games, all randomness through the seeded RNG, tests for core logic), the git workflow (section 11) and the license.
- **`.claude/skills/add-minigame/SKILL.md`**: the step-by-step recipe for adding a new game module: folder, module definition, registry entry, settings, use of the shared core, stats summary, tests, and a final checklist.
- **`.claude/skills/add-plate-country/SKILL.md`** **(builder's call):** the recipe for adding a license plate country format.
- **`docs/agents/`**: context for agents, split into subfolders. The owner hasn't settled the exact layout, and it may grow. Start with:
  - `docs/agents/specs/`: design documents (this file).
  - `docs/agents/plans/`: implementation plans.
  - `docs/agents/context/`: `architecture.md` (how core and modules connect) and `memory-theory.md` (the memory palace, Major System and art of memory ideas behind each game, so future games stay true to that theory).
  - `docs/agents/decisions/`: a short running log of decisions and why.
- **`docs/<module>/`** (e.g. `docs/maze/`) is reserved for human-facing explanations that the owner will have another agent write after each module is finished. Don't write these during the build.

## 11. Git workflow

- Never commit straight to `main`. Work on a branch per milestone, then commit and **push to `origin`** (github.com/MrRaven07/MemorizeThis_knee) once a milestone works and its tests pass. The owner merges.
- The old mockup files (`css/`, `js/`, `pages/`, `assets/`, the deleted `src/`) are removed as part of the rewrite.
- `.gitignore` covers `node_modules/`, `dist/` and `.superpowers/`.
- **(builder's call)** Suggested milestone order: project scaffold + core + agent files → Long Number → Number Flash → Plates → Maze → Card Match → Major System → Stats and sessions → cleanup.

## 12. Testing

- Unit tests for everything in `core/` (timing math, staircase, alignment scoring, RNG, storage migrations) and for each game's pure logic (number generation, plate generation and validity, maze generation and solvability, route simulation, card-match scoring and memory-mistake counting, Major import/export round-trips with diacritics, the flashcard scheduler).
- Components get light tests where behavior matters (phase transitions). No end-to-end suite required for now.

## 13. Left to the builder

- Exact TypeScript types for the module contract and stores.
- Exact default values not given above, the visual details within the dark focus direction, and the card face symbols.
- The internal structure of each game folder beyond what's described.
- Whether history lives in `localStorage` or IndexedDB, as long as it stays behind the adapter.
- The exact Romanian plate rules (research and cite them in the plate format file).
