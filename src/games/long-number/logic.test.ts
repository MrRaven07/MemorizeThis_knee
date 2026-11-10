import { describe, expect, it } from 'vitest'
import { createRng } from '@/core/random/rng'
import { sanitizeSettings } from '@/games/settings'
import type { RoundRecord } from '@/games/types'
import {
  formatGroups,
  generateGroups,
  LONG_NUMBER_DEFAULTS,
  LONG_NUMBER_FIELDS,
  normalizeAnswer,
  scoreLongNumber,
  summarizeLongNumber,
} from './logic'

describe('long number logic', () => {
  it('defaults are valid against their own fields', () => {
    expect(sanitizeSettings(LONG_NUMBER_DEFAULTS, LONG_NUMBER_DEFAULTS, LONG_NUMBER_FIELDS)).toEqual(
      LONG_NUMBER_DEFAULTS,
    )
    expect(LONG_NUMBER_DEFAULTS).toEqual({
      groups: 1,
      digitsPerGroup: 10,
      separateGroups: true,
      memorizeSeconds: 15,
      delaySeconds: 5,
      recallSeconds: 0,
    })
  })

  it('generates the configured shape', () => {
    const g = generateGroups(createRng(5), { ...LONG_NUMBER_DEFAULTS, groups: 3, digitsPerGroup: 4 })
    expect(g).toHaveLength(3)
    g.forEach((x) => expect(x).toMatch(/^\d{4}$/))
  })

  it('formats with or without visual separators', () => {
    expect(formatGroups(['12', '34'], true)).toBe('12\u200934') // thin space
    expect(formatGroups(['12', '34'], false)).toBe('1234')
  })

  it('normalizeAnswer strips all whitespace', () => {
    expect(normalizeAnswer(' 12\t34\n 56 ')).toBe('123456')
  })

  it('ignores spaces and newlines in the answer', () => {
    expect(scoreLongNumber(['1234', '5678'], ' 1234 5678\n').exact).toBe(true)
  })

  it('counts letters as wrong characters, not a crash', () => {
    const r = scoreLongNumber(['123'], '1a3')
    expect(r.correct).toBe(2)
    expect(r.exact).toBe(false)
  })

  it('summary headline uses the longest perfect round', () => {
    const mk = (len: number, success: boolean): RoundRecord => ({
      id: String(len),
      gameId: 'long-number',
      at: 0,
      sessionId: null,
      success,
      level: null,
      accuracy: success ? 1 : 0.5,
      durationMs: 1,
      metrics: { length: len, correct: success ? len : len / 2 },
    })
    const s = summarizeLongNumber([mk(10, true), mk(24, true), mk(30, false)])
    expect(s.headline).toBe('best 24')
    expect(s.stats).toEqual([
      { label: 'Rounds', value: '3' },
      { label: 'Best (100%)', value: '24 digits' },
      { label: 'Average accuracy (last 10)', value: '83%' },
    ])
    expect(summarizeLongNumber([]).headline).toBe('not played')
  })
})
