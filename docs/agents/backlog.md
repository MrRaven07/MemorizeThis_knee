# Backlog: future modules

Ideas the owner wants built. Each one becomes a plan in `plans/` and a ruling in `questions/` before code is written. When you pick one up, set its status, link its plan and branch, and keep this table current.

| # | Module | Owner's request | Status | Plan | Branch |
|---|--------|-----------------|--------|------|--------|
| 1 | **Kim's Game** (`kims-game`) | "A tray of 10–20 objects appears, then disappears. The player lists them all, or says which one went missing. This is a classic scout and sniper exercise." | in progress | [plan 14](plans/2026-11-18-plan-14-kims-game.md) · [questions/016](questions/016-kims-game.md) | `feat/kims-game` |
| 2 | **Simon-style Sequence** (`sequence`) | "Colors or tones that grow longer each round. The scope is to make it for many many rounds." | in progress | [plan 15](plans/2026-11-18-plan-15-simon-sequence.md) · [questions/017](questions/017-simon-sequence.md) | `feat/simon-sequence` |

Status values: `idea` → `planned` → `in progress` → `pushed` (waiting for the owner to merge) → `merged`.

## How to pick up an item

1. Read `CLAUDE.md`, the `add-minigame` skill and `context/memory-theory.md`.
2. Branch from `main` (`feat/<id>`). Another agent may be working in the main checkout, so use a git worktree (`git worktree add ../wt-<id> -b feat/<id> origin/main`) instead of switching branches there.
3. Follow the plan. The question file holds the binding rules. New questions go in a new file in `questions/` (next free number) and to the manager agent.
4. Done = `npx vitest run && npm run type-check && npm run lint && npm run build` green, decisions log + memory-theory updated, branch pushed. The owner merges.
