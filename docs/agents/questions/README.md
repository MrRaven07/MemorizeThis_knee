# Questions

The record of questions that came up while building. The builder agent asks, the **manager agent** answers, and anything only the owner can decide is escalated to them.

## Roles

- **Builder:** the agent implementing a plan. When something is unclear, it writes a question file here first, then asks the manager.
- **Manager:** a separate agent that knows the spec, the plans and the owner's decisions. It answers in the same file. It settles minor things itself, in line with the spec's intent, and escalates to the owner anything that would change what gets built in a way only the owner can decide.
- **Owner:** has the final word. Escalated questions wait for them.

## File format

One file per question: `NNN-short-topic.md` (e.g. `001-plate-letter-rules.md`), numbered in order.

```markdown
# NNN — Short title

- **Status:** open | answered | escalated | resolved-by-owner
- **Asked by:** builder · **Date:** YYYY-MM-DD
- **Plan / task:** plan-1 task 6

## Question
What's unclear, and the options being considered.

## Why it matters
What changes in the build depending on the answer.

## Answer
(manager) The decision, and the spec section or reasoning behind it.

## Owner decision
(only if escalated)
```

## Index

| # | Topic | Status |
|---|-------|--------|
| 001 | Esc means both skip and quit | answered |
| 002 | Sessions never ended explicitly | answered |
| 003 | Restore overwriting newer data | answered |
| 004 | Settings changed mid-round | answered |
| 005 | Number Flash reveal vs display time | answered |
| 006 | Number Flash flow between rounds | answered |
| 007 | Plates difficulty steps and recall | answered |
| 008 | Maze levels, layout and route input | answered |
| 009 | Card Match levels, preview, success, memory mistakes | answered |
| 010 | Major flashcards scheduling, import, picking | open |
