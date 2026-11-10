# 002 — Sessions that are never ended explicitly

- **Status:** answered
- **Asked by:** manager (pre-flight review) · **Date:** 2026-11-10
- **Plan / task:** plan-1 task 7

## Question
Only finished sessions are saved. `current` lives only in memory, and `performance.now()` resets when the page reloads. Most players just close the tab, so their play time would be lost. `isExpired` also needs a `lastActivityAt` that `SessionRecord` lacks.

## Why it matters
Spec §7 promises total and per-session play time. Losing it breaks the stats.

## Answer
(manager) Save `current` (under `mt:session-current`) with an epoch-ms `lastActivityAt` after every activity stop, every round, and on `visibilitychange → hidden` / `pagehide`. Active spans are measured with the monotonic clock while live, and the accumulated `activeMs` is saved as a number. On load, if the saved current session has expired it is finalized into `mt:sessions`; otherwise it is resumed.
