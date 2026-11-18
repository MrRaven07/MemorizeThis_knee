import { describe, expect, it } from 'vitest'
import { createRng } from '@/core/random/rng'
import { sanitizeSettings } from '@/games/settings'
import type { RoundRecord } from '@/games/types'
import {
  GRID_LEVELS,
  MEMORY_GRID_DEFAULTS,
  MEMORY_GRID_FIELDS,
  MEMORY_GRID_ID,
  generatePattern,
  gridLevelInfo,
  gridStaircase,
  gridViewMs,
  scoreGrid,
  summarizeMemoryGrid,
} from './logic'

describe('memory grid logic', () => {
  it('ids, defaults, staircase', () => {
    expect(MEMORY_GRID_ID).toBe('memory-grid')
    expect(MEMORY_GRID_DEFAULTS).toEqual({ timeMultiplier: 1, upAfter: 3 })
    expect(
      sanitizeSettings(MEMORY_GRID_DEFAULTS, MEMORY_GRID_DEFAULTS, MEMORY_GRID_FIELDS),
    ).toEqual(MEMORY_GRID_DEFAULTS)
    expect(gridStaircase({ ...MEMORY_GRID_DEFAULTS, upAfter: 4 })).toEqual({
      start: 1,
      min: 1,
      max: 12,
      upAfter: 4,
      upStep: 1,
      downAfter: 1,
      downStep: 1,
    })
    expect(gridLevelInfo(99)).toBe(GRID_LEVELS[11])
  })

  it('levels match the ruling and never get easier', () => {
    expect(GRID_LEVELS.map((l) => `${l.size}/${l.lit}`)).toEqual([
      '3/3',
      '3/4',
      '4/5',
      '4/6',
      '4/7',
      '5/8',
      '5/9',
      '5/10',
      '6/11',
      '6/12',
      '6/14',
      '7/16',
    ])
    const problems = GRID_LEVELS.flatMap((l, i) => {
      const p = GRID_LEVELS[i - 1]
      return p && (l.size < p.size || l.lit <= p.lit) ? [`L${i + 1}`] : []
    })
    expect(problems).toEqual([])
  })

  it('view time grows with lit cells, scales, and has a floor', () => {
    expect(gridViewMs(1, 1)).toBe(1450)
    expect(gridViewMs(12, 1)).toBe(3400)
    expect(gridViewMs(1, 2)).toBe(2900)
    expect(gridViewMs(1, 0.1)).toBe(500)
  })

  it('patterns have the right count, distinct cells in range, and never repeat back-to-back', () => {
    const rng = createRng(4)
    let prev: number[] | undefined
    for (let i = 0; i < 200; i++) {
      const p = generatePattern(rng, 3, 3, prev)
      expect(p).toHaveLength(3)
      expect(new Set(p).size).toBe(3)
      expect(p.every((c) => c >= 0 && c < 9)).toBe(true)
      expect(p).toEqual([...p].sort((a, b) => a - b))
      if (prev) expect(p).not.toEqual(prev)
      prev = p
    }
  })

  it('scoring: exact, misses, wrong taps; tapping everything scores low', () => {
    expect(scoreGrid([1, 4, 7], [1, 4, 7])).toEqual({
      hits: 3,
      misses: 0,
      wrong: 0,
      exact: true,
      accuracy: 1,
    })
    expect(scoreGrid([1, 4, 7], [1, 4, 8])).toEqual({
      hits: 2,
      misses: 1,
      wrong: 1,
      exact: false,
      accuracy: 0.5,
    })
    const all = scoreGrid([1, 4, 7], [0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(all.accuracy).toBeCloseTo(3 / 9)
    expect(scoreGrid([1], []).accuracy).toBe(0)
  })

  it('summary', () => {
    const mk = (level: number, success: boolean, accuracy: number): RoundRecord => ({
      id: `${level}${accuracy}`,
      gameId: 'memory-grid',
      at: 0,
      sessionId: null,
      success,
      level,
      accuracy,
      durationMs: 1,
      metrics: {},
    })
    const s = summarizeMemoryGrid([mk(3, true, 1), mk(5, true, 1), mk(6, false, 0.5)])
    expect(s.headline).toBe('best level 5')
    expect(s.stats).toEqual([
      { label: 'Rounds', value: '3' },
      { label: 'Best level', value: '5' },
      { label: 'Accuracy (last 10)', value: '83%' },
      { label: 'Success (last 20)', value: '67%' },
    ])
    expect(summarizeMemoryGrid([]).headline).toBe('not played')
    expect(summarizeMemoryGrid([mk(1, false, 0.2)]).headline).toBe('no perfect round yet')
  })
})
