# 011 — Stats page and session summary

- **Status:** answered
- **Asked by:** builder · **Date:** 2026-11-11
- **Plan / task:** plan-7 (Stats + session summary), being written

## Question
Spec §7 says: a session clock that counts up; **End session** → a summary (time played, games played, rounds, levels reached, comparison with the previous session); a 30-minute idle auto-end; a Stats page with each module's stats plus totals (total time, time per game, sessions, rounds); start with clear numbers and simple trend lines. Proposals:

1. **Where "End session" lives:** a small button next to the session clock on **Home** (only while a session exists). Not inside games (to avoid ending mid-round). It leads to `/session/summary`, which shows the session just ended. The summary is also reachable later from the Stats page ("Last session").
2. **Summary contents:** active time; rounds; games played (distinct gameIds with a round, plus "Major System: N cards" when flashcards were answered); per game: rounds, time, best result this session (the game's own `summarize` headline over this session's rounds), and the **level at the end** for adaptive games (from the stats store staircase); comparison with the previous session: "+12 min / −3 rounds vs last time".
3. **Flashcard answers in sessions:** add `cards: number` to `SessionRecord` (default 0, so old records stay readable; no migration needed because the guard defaults missing numbers). `decks.recordAnswer` calls `session.noteCard()`.
4. **Stats page `/stats`:** a totals card (total active time, sessions, rounds, flashcard answers, current streak of days with ≥ 1 session), a time-per-game bar list (games + Major, sorted by time), then one section per game: the `summarize().stats` list plus a **sparkline** of accuracy over the last 30 rounds (inline SVG, accent colour, no library). A Major section links to the decks. A "Recent sessions" list (last 10: date, time, rounds).
5. **Auto-end:** already in place (30 min idle → finalized on the next activity or load). The summary page shows the last finished session if there's no open one.
6. **Navigation:** Home footer gets a "Stats" link next to Settings.

## Why it matters
It decides where a session ends and what the player sees as progress (spec §1 "over weeks the stats should show them getting better").

## Answer
(manager) **Approved, with three changes (points 3 and 4, and the summary route).** Spec §13 leaves the details open, so these are my calls. No escalation needed.

1. **End session on Home only: approved.** This avoids ending a session mid-round. Show the button next to the session clock only while a session exists. **Route change:** use `/session/:id` (route name `session`) instead of `/session/summary`. End session finalizes the session and navigates to its id. The Stats page's "Recent sessions" rows link to the same page, so any past session can be opened, including ones that auto-ended. An unknown id redirects to `/stats`.
2. **Summary contents: approved.** "Previous session" means the session that finished before this one. Omit the comparison line for the first session. Per-game time comes from `perGameMs`, and Major appears as "Major System: N cards, time".
3. **`cards` in `SessionRecord`: approved, but add a real migration.** CLAUDE.md's rule is: when a saved shape changes, add a migration and bump `SCHEMA_VERSION`. Keep the rule without exceptions; it's easier for a Vue learner to follow than "unless a guard covers it". The migration sets `cards: 0` on every record in `mt:sessions` and on `mt:session-current`, then bumps the version by one. Test it with a v-old fixture. Keeping the read-time guard as well is fine. `decks.recordAnswer` → `session.noteCard()`: approved.
4. **Stats page: approved, with a different trend line.** Spec §1 says that "over weeks the stats should show them getting better", but 30 rounds can be one evening. So:
   - The **sparkline has one point per local calendar day** with rounds (the last 30 such days). For games whose rounds have a non-null `level` (the adaptive games), the value is that day's highest level. For the others (Long Number), it's that day's average accuracy. No change to the GameModule contract is needed.
   - Label it ("Level by day" / "Accuracy by day"), and give it an `aria-label` such as "from 5 to 9 over 12 days". With fewer than 2 days, show "The trend appears after two days of play."
   - Draw it as inline SVG using tokens only, with no library.
   - Totals and time per game **include the open session** (live). Day streak: approved, counted in local days.
   - Totals card, the bar list, per-game `summarize().stats`, the Major section linking to the decks, and Recent sessions (last 10, each linking to `/session/:id`): approved.
5. **Auto-end: approved** as already built.
6. **Navigation: approved.** A Stats link in the Home footer next to Settings, and a link back to Home on both new pages (spec §9).
