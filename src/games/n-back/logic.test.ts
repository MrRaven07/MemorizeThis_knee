import { describe, expect, it } from 'vitest'
import { createRng } from '@/core/random/rng'
import { sanitizeSettings } from '@/games/settings'
import type { RoundRecord } from '@/games/types'
import {
  N_BACK_DEFAULTS,
  N_BACK_FIELDS,
  N_BACK_ID,
  POSITIONS,
  DIGITS,
  TARGETS_PER_STREAM,
  generateStream,
  levelKey,
  nBackAccuracy,
  nBackStaircase,
  nextNBackState,
  scoreStream,
  summarizeNBack,
  trialsFor,
} from './logic'

describe('n-back logic', () => {
  it('ids, defaults and staircase', () => {
    expect(N_BACK_ID).toBe('n-back')
    expect(N_BACK_DEFAULTS).toEqual({ mode: 'position', trialMs: 2500, feedback: true, upAfter: 3 })
    expect(sanitizeSettings(N_BACK_DEFAULTS, N_BACK_DEFAULTS, N_BACK_FIELDS)).toEqual(
      N_BACK_DEFAULTS,
    )
    expect(nBackStaircase({ ...N_BACK_DEFAULTS, upAfter: 4 })).toEqual({
      start: 2,
      min: 1,
      max: 9,
      upAfter: 4,
      upStep: 1,
      downAfter: 1,
      downStep: 1,
    })
    expect(levelKey('dual')).toBe('n-back:dual')
    expect(trialsFor(2)).toBe(22)
  })

  it('streams have exactly 6 targets and no accidental matches (many seeds, all N)', () => {
    const problems: string[] = []
    for (const alphabet of [POSITIONS, DIGITS])
      for (let n = 1; n <= 9; n++) {
        for (let seed = 0; seed < 200; seed++) {
          const size = trialsFor(n)
          const s = generateStream(createRng(seed * 13 + n), n, size, alphabet)
          let targets = 0
          for (let i = n; i < size; i++) if (s[i] === s[i - n]) targets++
          if (s.length !== size) problems.push(`n${n} s${seed} length`)
          if (targets !== TARGETS_PER_STREAM) problems.push(`n${n} s${seed} targets ${targets}`)
          if (s.some((v) => v < 0 || v > alphabet - 1)) problems.push(`n${n} s${seed} range`)
        }
      }
    expect(problems).toEqual([])
  })

  it('scoring counts hits, misses, false alarms and correct rejections', () => {
    // n = 1: trials 1..4 scorable; targets at 2 and 4
    const stream = [5, 3, 3, 7, 7]
    const presses = [false, true, true, false, false]
    expect(scoreStream(stream, 1, presses)).toEqual({
      hits: 1,
      misses: 1,
      falseAlarms: 1,
      correctRejections: 1,
    })
  })

  it('never pressing scores 0, not 70%', () => {
    const counts = { hits: 0, misses: 6, falseAlarms: 0, correctRejections: 14 }
    expect(nBackAccuracy([counts])).toBe(0)
    expect(nBackAccuracy([{ hits: 6, misses: 0, falseAlarms: 0, correctRejections: 14 }])).toBe(1)
    expect(
      nBackAccuracy([
        { hits: 3, misses: 3, falseAlarms: 0, correctRejections: 14 },
        { hits: 6, misses: 0, falseAlarms: 0, correctRejections: 14 },
      ]),
    ).toBeCloseTo(0.75)
  })

  it('three-zone level step', () => {
    const cfg = nBackStaircase(N_BACK_DEFAULTS)
    const s = { level: 4, streakRight: 1, streakWrong: 0 }
    expect(nextNBackState(s, cfg, 0.85)).toEqual({ level: 4, streakRight: 2, streakWrong: 0 })
    expect(nextNBackState({ ...s, streakRight: 2 }, cfg, 0.9).level).toBe(5)
    expect(nextNBackState(s, cfg, 0.6)).toEqual({ level: 4, streakRight: 0, streakWrong: 0 })
    expect(nextNBackState(s, cfg, 0.4).level).toBe(3)
  })

  it('summary', () => {
    const mk = (n: number, mode: number, success: boolean, accuracy: number): RoundRecord => ({
      id: `${n}${mode}${accuracy}`,
      gameId: 'n-back',
      at: 0,
      sessionId: null,
      success,
      level: n,
      accuracy,
      durationMs: 1,
      metrics: { n, mode },
    })
    const s = summarizeNBack([
      mk(2, 0, true, 0.9),
      mk(3, 0, true, 0.8),
      mk(2, 2, true, 0.85),
      mk(4, 0, false, 0.5),
    ])
    expect(s.headline).toBe('best N=3 (position)')
    expect(s.stats).toEqual([
      { label: 'Rounds', value: '4' },
      { label: 'Highest N (position)', value: '3' },
      { label: 'Highest N (dual)', value: '2' },
      { label: 'Accuracy (last 10)', value: '76%' },
      { label: 'Success (last 20)', value: '75%' },
    ])
    expect(summarizeNBack([]).headline).toBe('not played')
    expect(summarizeNBack([mk(2, 1, false, 0.3)]).headline).toBe('no round passed yet')
  })
})
