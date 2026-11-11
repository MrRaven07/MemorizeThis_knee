import { describe, expect, it } from 'vitest'
import { createRng } from '@/core/random/rng'
import { sanitizeSettings } from '@/games/settings'
import type { RoundRecord } from '@/games/types'
import { ro } from './formats/ro'
import type { Plate } from './formats/types'
import {
  generateRound,
  levelInfo,
  normalizePlateInput,
  PLATE_LEVELS,
  PLATES_DEFAULTS,
  PLATES_FIELDS,
  PLATES_ID,
  PLATES_STAIRCASE,
  scorePlates,
  summarizePlates,
  viewMs,
} from './logic'

const plate = (text: string): Plate => ({ country: 'ro', segments: text.split(' '), text })

describe('plates logic', () => {
  it('ids, defaults and staircase', () => {
    expect(PLATES_ID).toBe('plates')
    expect(sanitizeSettings(PLATES_DEFAULTS, PLATES_DEFAULTS, PLATES_FIELDS)).toEqual(
      PLATES_DEFAULTS,
    )
    expect(PLATES_DEFAULTS).toEqual({ country: 'ro', timeMultiplier: 1, upAfter: 3 })
    expect(PLATES_STAIRCASE).toEqual({
      start: 1,
      min: 1,
      max: 12,
      upAfter: 3,
      upStep: 1,
      downAfter: 1,
      downStep: 1,
    })
  })

  it('level table matches the ruling', () => {
    expect(PLATE_LEVELS).toHaveLength(12)
    expect(PLATE_LEVELS[0]).toEqual({ plates: 1, viewSeconds: 6, minScale: 1, maxScale: 1 })
    expect(PLATE_LEVELS[3]).toEqual({ plates: 2, viewSeconds: 6, minScale: 0.75, maxScale: 1.25 })
    expect(PLATE_LEVELS[6]).toEqual({ plates: 4, viewSeconds: 10, minScale: 0.6, maxScale: 1.4 })
    expect(PLATE_LEVELS[11]).toEqual({ plates: 6, viewSeconds: 8, minScale: 0.5, maxScale: 1.5 })
  })

  it('difficulty never decreases', () => {
    const problems: string[] = []
    for (let i = 1; i < PLATE_LEVELS.length; i++) {
      const a = PLATE_LEVELS[i - 1]!
      const b = PLATE_LEVELS[i]!
      if (b.plates < a.plates) problems.push(`L${i + 1}: fewer plates`)
      if (a.plates === b.plates && b.viewSeconds >= a.viewSeconds)
        problems.push(`L${i + 1}: not less time`)
      if (b.maxScale - b.minScale < a.maxScale - a.minScale)
        problems.push(`L${i + 1}: narrower sizes`)
    }
    expect(problems).toEqual([])
  })

  it('levelInfo clamps', () => {
    expect(levelInfo(0)).toBe(PLATE_LEVELS[0])
    expect(levelInfo(99)).toBe(PLATE_LEVELS[11])
  })

  it('viewMs floor', () => {
    expect(viewMs(1, 1)).toBe(6000)
    expect(viewMs(2, 0.5)).toBe(2000)
    expect(viewMs(12, 2)).toBe(16000)
    expect(viewMs(99, 1)).toBe(8000)
    expect(viewMs(2, 0.1)).toBe(1000)
  })

  it('generateRound at level 12: distinct plates, no consecutive county, scales in range', () => {
    const r = generateRound(createRng(3), 12, ro)
    expect(r.plates).toHaveLength(6)
    expect(new Set(r.plates.map((p) => p.text)).size).toBe(6)
    for (let i = 1; i < r.plates.length; i++) {
      expect(r.plates[i]!.segments[0]).not.toBe(r.plates[i - 1]!.segments[0])
    }
    for (const s of r.scales) {
      expect(s).toBeGreaterThanOrEqual(0.5)
      expect(s).toBeLessThanOrEqual(1.5)
    }
    expect(generateRound(createRng(3), 1, ro).scales).toEqual([1])
  })

  it('normalizes input', () => {
    expect(normalizePlateInput(' b-505 lsk ')).toBe('B505LSK')
    expect(scorePlates([plate('B 505 LSK')], ['b 505 lsk']).success).toBe(true)
    const two = scorePlates([plate('B 505 LSK'), plate('MM 12 ABC')], ['B505LSK', 'MM12ABD'])
    expect(two.success).toBe(false)
    expect(two.accuracy).toBeCloseTo((1 + 6 / 7) / 2)
    const missing = scorePlates([plate('B 505 LSK')], [])
    expect(missing.success).toBe(false)
    expect(missing.perPlate[0]!.correct).toBe(0)
    const diacritic = scorePlates([plate('B 505 LSK')], ['B 505 LȘK'])
    expect(diacritic.perPlate[0]!.correct).toBe(6)
  })

  it('summary', () => {
    const mk = (level: number, success: boolean, plates: number): RoundRecord => ({
      id: `${level}`,
      gameId: 'plates',
      at: 0,
      sessionId: null,
      success,
      level,
      accuracy: success ? 1 : 0.5,
      durationMs: 1,
      metrics: { plates, correct: success ? plates : 0 },
    })
    const s = summarizePlates([mk(3, true, 2), mk(5, true, 3), mk(6, false, 3)])
    expect(s.headline).toBe('best level 5')
    expect(s.stats).toEqual([
      { label: 'Rounds', value: '3' },
      { label: 'Best level', value: '5' },
      { label: 'Most plates at once', value: '3' },
      { label: 'Success (last 20)', value: '67%' },
    ])
    expect(summarizePlates([]).headline).toBe('not played')
    expect(summarizePlates([mk(1, false, 1)]).headline).toBe('no perfect round yet')
  })
})
