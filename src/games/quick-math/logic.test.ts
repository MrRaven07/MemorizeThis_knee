import { describe, expect, it } from 'vitest'
import { createRng } from '@/core/random/rng'
import { sanitizeSettings } from '@/games/settings'
import type { RoundRecord } from '@/games/types'
import {
  MATH_LEVELS,
  QUICK_MATH_DEFAULTS,
  QUICK_MATH_FIELDS,
  QUICK_MATH_ID,
  enabledOps,
  generateProblem,
  mathOutcome,
  mathStaircase,
  parseAnswer,
  summarizeQuickMath,
  targetCorrect,
  type Op,
} from './logic'

describe('quick math logic', () => {
  it('ids, defaults, staircase', () => {
    expect(QUICK_MATH_ID).toBe('quick-math')
    expect(QUICK_MATH_DEFAULTS).toEqual({
      sprintSeconds: 60,
      add: true,
      sub: true,
      mul: true,
      div: true,
      mod: true,
      upAfter: 3,
    })
    expect(sanitizeSettings(QUICK_MATH_DEFAULTS, QUICK_MATH_DEFAULTS, QUICK_MATH_FIELDS)).toEqual(
      QUICK_MATH_DEFAULTS,
    )
    expect(mathStaircase(QUICK_MATH_DEFAULTS)).toMatchObject({
      start: 1,
      min: 1,
      max: 10,
      upAfter: 3,
    })
    expect(MATH_LEVELS).toHaveLength(10)
  })

  it('targets fall as levels get harder and scale with sprint length', () => {
    const t = MATH_LEVELS.map((l) => l.targetPerMinute)
    expect(t[0]).toBe(20)
    expect(t[9]).toBe(6)
    expect(t.every((v, i) => i === 0 || v <= t[i - 1]!)).toBe(true)
    expect(targetCorrect(1, 60)).toBe(20)
    expect(targetCorrect(1, 30)).toBe(10)
    expect(targetCorrect(10, 90)).toBe(9)
  })

  it('enabled operations; all off means all on (with a flag)', () => {
    expect(enabledOps({ ...QUICK_MATH_DEFAULTS, add: false, sub: false })).toEqual({
      ops: ['mul', 'div', 'mod'],
      allOff: false,
    })
    const off = {
      ...QUICK_MATH_DEFAULTS,
      add: false,
      sub: false,
      mul: false,
      div: false,
      mod: false,
    }
    expect(enabledOps(off)).toEqual({ ops: ['add', 'sub', 'mul', 'div', 'mod'], allOff: true })
  })

  it('problems are correct, exact, non-negative, at every level and op', () => {
    const ops: Op[] = ['add', 'sub', 'mul', 'div', 'mod']
    const problems: string[] = []
    const rng = createRng(3)
    for (let level = 1; level <= 10; level++) {
      for (const op of ops) {
        let prev: string | undefined
        for (let i = 0; i < 300; i++) {
          const p = generateProblem(rng, level, [op], prev)
          const real = {
            add: p.a + p.b,
            sub: p.a - p.b,
            mul: p.a * p.b,
            div: p.a / p.b,
            mod: p.a % p.b,
          }[op]
          if (p.answer !== real) problems.push(`L${level} ${p.text} = ${p.answer} (real ${real})`)
          if (!Number.isInteger(p.answer) || p.answer < 0)
            problems.push(`L${level} ${p.text} bad answer`)
          if (op === 'mod' && p.b < 2) problems.push(`L${level} ${p.text} mod < 2`)
          if (p.text === prev) problems.push(`L${level} repeat ${p.text}`)
          prev = p.text
        }
      }
    }
    expect(problems.slice(0, 5)).toEqual([])
  })

  it('symbols in the text', () => {
    const rng = createRng(1)
    expect(generateProblem(rng, 1, ['mul']).text).toMatch(/^\d+ × \d+$/)
    expect(generateProblem(rng, 1, ['div']).text).toMatch(/^\d+ ÷ \d+$/)
    expect(generateProblem(rng, 1, ['mod']).text).toMatch(/^\d+ mod \d+$/)
    expect(generateProblem(rng, 1, ['sub']).text).toMatch(/^\d+ − \d+$/)
  })

  it('answers are compared as integers', () => {
    expect(parseAnswer('07')).toBe(7)
    expect(parseAnswer(' 42 ')).toBe(42)
    expect(parseAnswer('')).toBeNull()
    expect(parseAnswer('4a')).toBeNull()
    expect(parseAnswer('-3')).toBeNull()
  })

  it('three zones: pass needs ≥90% and the target; <60% drops', () => {
    expect(mathOutcome(20, 2, 1, 60)).toBe('pass')
    expect(mathOutcome(19, 0, 1, 60)).toBe('stay')
    expect(mathOutcome(20, 4, 1, 60)).toBe('stay')
    expect(mathOutcome(5, 5, 1, 60)).toBe('drop')
    expect(mathOutcome(0, 0, 1, 60)).toBe('drop')
  })

  it('summary', () => {
    const mk = (
      level: number,
      success: boolean,
      perMinute: number,
      accuracy: number,
    ): RoundRecord => ({
      id: `${level}${perMinute}`,
      gameId: 'quick-math',
      at: 0,
      sessionId: null,
      success,
      level,
      accuracy,
      durationMs: 1,
      metrics: { perMinute },
    })
    const s = summarizeQuickMath([mk(2, true, 18, 1), mk(4, true, 14.5, 0.9), mk(5, false, 9, 0.5)])
    expect(s.headline).toBe('best level 4')
    expect(s.stats).toEqual([
      { label: 'Rounds', value: '3' },
      { label: 'Best level', value: '4' },
      { label: 'Best correct per minute', value: '18' },
      { label: 'Accuracy (last 10)', value: '80%' },
    ])
    expect(summarizeQuickMath([]).headline).toBe('not played')
  })
})
