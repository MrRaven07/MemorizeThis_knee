# 001 — Esc means both "skip" and "quit"

- **Status:** answered
- **Asked by:** manager (pre-flight review) · **Date:** 2026-11-10
- **Plan / task:** plan-1 tasks 9 and 12

## Question
`GameShell` quits on Esc unless an input has focus. During Long Number's memorize phase no input has focus, but Esc there means Skip. A single press could skip and quit at once.

## Why it matters
Players would lose rounds by accident.

## Answer
(manager) The game handles Esc first and calls `preventDefault()`. `GameShell` quits only when `!event.defaultPrevented`. This is generic: any game can claim Esc in a phase.
