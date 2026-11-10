# 003 — Restore can silently overwrite newer data

- **Status:** answered
- **Asked by:** manager (pre-flight review) · **Date:** 2026-11-10
- **Plan / task:** plan-1 tasks 6 and 10

## Question
Does restoring a backup replace or merge, and is there a confirmation? Restoring an old backup could wipe newer data.

## Why it matters
Spec §2 anti-goal: never lose the player's data.

## Answer
(manager) Restore **replaces** all `mt:` keys, but only after (1) the file passes validation (every data value is a string; `app` and `version` are checked) and (2) an in-page confirmation step that says it will replace the current data and offers "Download current data first". Never use `confirm()`.
