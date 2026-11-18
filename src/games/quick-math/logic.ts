import type { StaircaseConfig } from '@/core/difficulty/staircase'
import type { Rng } from '@/core/random/rng'
import type { GameSettings, GameSummary, RoundRecord, SettingField } from '@/games/types'

/**
 * Quick Math: a timed sprint of simple operations. A working-memory drill
 * (holding operands and carries in mind), not a memory technique — proposed by
 * the owner; rules in question 015.
 */
export const QUICK_MATH_ID = 'quick-math'

export type Op = 'add' | 'sub' | 'mul' | 'div' | 'mod'
export const ALL_OPS: readonly Op[] = ['add', 'sub', 'mul', 'div', 'mod']
const SYMBOL: Record<Op, string> = { add: '+', sub: '−', mul: '×', div: '÷', mod: 'mod' }

export interface QuickMathSettings extends GameSettings {
  sprintSeconds: number
  add: boolean
  sub: boolean
  mul: boolean
  div: boolean
  mod: boolean
  upAfter: number
}

export const QUICK_MATH_DEFAULTS: QuickMathSettings = {
  sprintSeconds: 60,
  add: true,
  sub: true,
  mul: true,
  div: true,
  mod: true,
  upAfter: 3,
}

export const QUICK_MATH_FIELDS: SettingField[] = [
  {
    key: 'sprintSeconds',
    label: 'Sprint length',
    type: 'number',
    min: 30,
    max: 180,
    step: 15,
    unit: 's',
  },
  { key: 'add', label: 'Addition (+)', type: 'boolean' },
  { key: 'sub', label: 'Subtraction (−)', type: 'boolean' },
  { key: 'mul', label: 'Multiplication (×)', type: 'boolean' },
  { key: 'div', label: 'Division (÷)', type: 'boolean' },
  { key: 'mod', label: 'Remainder (mod)', type: 'boolean' },
  { key: 'upAfter', label: 'Passed sprints in a row to level up', type: 'number', min: 3, max: 5 },
]

type Range = readonly [number, number]

export interface MathLevel {
  /** both operands of + and − (subtraction is shown as sum − one operand) */
  add: Range
  mul: readonly [Range, Range]
  /** divisor and quotient; the dividend is their product (always exact) */
  div: readonly [Range, Range]
  /** dividend and divisor (divisor ≥ 2) */
  mod: readonly [Range, Range]
  /** typical seconds per problem for each operation (sets the pass target) */
  secPerProblem: Record<Op, number>
}

/** Difficulty curve (question 015). Index 0 = level 1. */
export const MATH_LEVELS: readonly MathLevel[] = [
  {
    add: [1, 9],
    mul: [
      [2, 5],
      [1, 9],
    ],
    div: [
      [2, 5],
      [1, 9],
    ],
    mod: [
      [1, 20],
      [2, 5],
    ],
    secPerProblem: { add: 2, sub: 2.5, mul: 3, div: 3.5, mod: 4 },
  },
  {
    add: [1, 20],
    mul: [
      [2, 9],
      [1, 9],
    ],
    div: [
      [2, 9],
      [1, 9],
    ],
    mod: [
      [5, 30],
      [2, 9],
    ],
    secPerProblem: { add: 2.5, sub: 3, mul: 3, div: 3.5, mod: 4.5 },
  },
  {
    add: [10, 50],
    mul: [
      [2, 12],
      [2, 12],
    ],
    div: [
      [2, 12],
      [2, 12],
    ],
    mod: [
      [10, 50],
      [2, 9],
    ],
    secPerProblem: { add: 3, sub: 3.5, mul: 3.5, div: 4, mod: 5 },
  },
  {
    add: [10, 99],
    mul: [
      [2, 12],
      [10, 20],
    ],
    div: [
      [2, 12],
      [2, 20],
    ],
    mod: [
      [20, 100],
      [3, 12],
    ],
    secPerProblem: { add: 3.5, sub: 4, mul: 5, div: 4.5, mod: 5.5 },
  },
  {
    add: [20, 99],
    mul: [
      [11, 20],
      [2, 9],
    ],
    div: [
      [2, 9],
      [11, 50],
    ],
    mod: [
      [30, 100],
      [3, 12],
    ],
    secPerProblem: { add: 4, sub: 4.5, mul: 5, div: 6, mod: 6 },
  },
  {
    add: [50, 199],
    mul: [
      [11, 25],
      [3, 12],
    ],
    div: [
      [3, 12],
      [10, 60],
    ],
    mod: [
      [50, 200],
      [3, 15],
    ],
    secPerProblem: { add: 4.5, sub: 5, mul: 6, div: 6, mod: 6.5 },
  },
  {
    add: [100, 499],
    mul: [
      [12, 30],
      [11, 19],
    ],
    div: [
      [11, 20],
      [5, 30],
    ],
    mod: [
      [100, 300],
      [5, 19],
    ],
    secPerProblem: { add: 5, sub: 5.5, mul: 9, div: 6, mod: 7 },
  },
  {
    add: [100, 999],
    mul: [
      [21, 49],
      [11, 29],
    ],
    div: [
      [11, 25],
      [10, 40],
    ],
    mod: [
      [100, 500],
      [7, 25],
    ],
    secPerProblem: { add: 6, sub: 7, mul: 14, div: 8, mod: 8 },
  },
  {
    add: [200, 999],
    mul: [
      [11, 99],
      [11, 49],
    ],
    div: [
      [12, 40],
      [10, 24],
    ],
    mod: [
      [200, 999],
      [11, 40],
    ],
    secPerProblem: { add: 6, sub: 7, mul: 18, div: 9, mod: 9 },
  },
  {
    add: [300, 999],
    mul: [
      [21, 99],
      [21, 99],
    ],
    div: [
      [11, 50],
      [10, 19],
    ],
    mod: [
      [100, 999],
      [11, 99],
    ],
    secPerProblem: { add: 6, sub: 7, mul: 25, div: 10, mod: 10 },
  },
]

export function mathStaircase(s: QuickMathSettings): StaircaseConfig {
  return {
    start: 1,
    min: 1,
    max: MATH_LEVELS.length,
    upAfter: s.upAfter,
    upStep: 1,
    downAfter: 1,
    downStep: 1,
  }
}

export function mathLevelInfo(level: number): MathLevel {
  const i = Math.min(MATH_LEVELS.length, Math.max(1, Math.round(level))) - 1
  return MATH_LEVELS[i]!
}

/**
 * Correct answers needed to pass: the sprint divided by the average time per
 * problem over the enabled operations (× is slower than +, so a ×-only
 * sprint needs fewer answers). Never below 1.
 */
export function targetCorrect(level: number, sprintSeconds: number, ops: readonly Op[]): number {
  const secs = mathLevelInfo(level).secPerProblem
  const used = ops.length > 0 ? ops : ALL_OPS
  const avg = used.reduce((a, op) => a + secs[op], 0) / used.length
  return Math.max(1, Math.round(sprintSeconds / avg))
}

/** The ops switched on; if none are, all of them (and `allOff` so the UI can say so). */
export function enabledOps(s: QuickMathSettings): { ops: Op[]; allOff: boolean } {
  const ops = ALL_OPS.filter((op) => s[op])
  return ops.length > 0 ? { ops, allOff: false } : { ops: [...ALL_OPS], allOff: true }
}

export interface Problem {
  op: Op
  a: number
  b: number
  answer: number
  text: string
}

function make(rng: Rng, level: number, op: Op): Problem {
  const L = mathLevelInfo(level)
  const r = (range: Range) => rng.int(range[0], range[1])
  let a: number
  let b: number
  let answer: number
  if (op === 'add') {
    a = r(L.add)
    b = r(L.add)
    answer = a + b
  } else if (op === 'sub') {
    const x = r(L.add)
    b = r(L.add)
    a = x + b
    answer = x
  } else if (op === 'mul') {
    a = r(L.mul[0])
    b = r(L.mul[1])
    answer = a * b
  } else if (op === 'div') {
    b = r(L.div[0])
    answer = r(L.div[1])
    a = b * answer
  } else {
    a = r(L.mod[0])
    b = Math.max(2, r(L.mod[1]))
    answer = a % b
  }
  return { op, a, b, answer, text: `${a} ${SYMBOL[op]} ${b}` }
}

/** A random problem from the enabled ops, never the same text twice in a row. */
export function generateProblem(
  rng: Rng,
  level: number,
  ops: Op[],
  previousText?: string,
): Problem {
  for (let tries = 0; ; tries++) {
    const p = make(rng, level, rng.pick(ops))
    if (p.text !== previousText || tries > 20) return p
  }
}

/** Non-negative integers only; `07` equals 7. */
export function parseAnswer(input: string): number | null {
  const t = input.trim()
  return /^\d+$/.test(t) ? Number.parseInt(t, 10) : null
}

/** Three zones (question 015): pass needs ≥ 90% and the target count; < 60% drops. */
export function mathOutcome(
  correct: number,
  wrong: number,
  level: number,
  sprintSeconds: number,
  ops: readonly Op[],
): 'pass' | 'stay' | 'drop' {
  const answered = correct + wrong
  const accuracy = answered === 0 ? 0 : correct / answered
  if (accuracy >= 0.9 && correct >= targetCorrect(level, sprintSeconds, ops)) return 'pass'
  if (accuracy < 0.6) return 'drop'
  return 'stay'
}

export function summarizeQuickMath(rounds: RoundRecord[]): GameSummary {
  if (rounds.length === 0) return { headline: 'not played', stats: [] }
  const wins = rounds.filter((r) => r.success).map((r) => r.level ?? 0)
  const best = wins.length > 0 ? Math.max(...wins) : null
  const bestRate = Math.max(...rounds.map((r) => r.metrics.perMinute ?? 0))
  const last10 = rounds.slice(-10)
  const acc = last10.reduce((a, r) => a + (r.accuracy ?? 0), 0) / last10.length
  return {
    headline: best === null ? 'no sprint passed yet' : `best level ${best}`,
    stats: [
      { label: 'Rounds', value: String(rounds.length) },
      { label: 'Best level', value: best === null ? '—' : String(best) },
      { label: 'Best correct per minute', value: String(Math.round(bestRate * 10) / 10) },
      { label: 'Accuracy (last 10)', value: `${Math.round(acc * 100)}%` },
    ],
  }
}
