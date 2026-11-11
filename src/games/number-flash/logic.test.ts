import { describe, expect, it } from 'vitest'
import { sanitizeSettings } from '@/games/settings'
import type { RoundRecord } from '@/games/types'
import {
  NUMBER_FLASH_DEFAULTS,
  NUMBER_FLASH_FIELDS,
  NUMBER_FLASH_ID,
  numberFlashStaircase,
  revealSchedule,
  scoreFlash,
  summarizeNumberFlash,
  visibleDigits,
} from './logic'

describe('number flash logic', () => {
  it('has a stable id', () => {
    expect(NUMBER_FLASH_ID).toBe('number-flash')
  })

  it('defaults are valid against their own fields', () => {
    expect(
      sanitizeSettings(NUMBER_FLASH_DEFAULTS, NUMBER_FLASH_DEFAULTS, NUMBER_FLASH_FIELDS),
    ).toEqual(NUMBER_FLASH_DEFAULTS)
    expect(NUMBER_FLASH_DEFAULTS).toEqual({
      revealMode: 'gradual',
      revealMsPerDigit: 250,
      baseDisplaySeconds: 4,
      extraSecondsPerDigit: 0.5,
      upAfter: 3,
      upStep: 1,
    })
  })

  it('staircase config follows the spec', () => {
    expect(numberFlashStaircase({ ...NUMBER_FLASH_DEFAULTS, upAfter: 5, upStep: 2 })).toEqual({
      start: 4,
      min: 3,
      max: 30,
      upAfter: 5,
      upStep: 2,
      downAfter: 1,
      downStep: 1,
    })
  })

  it('gradual schedule: one digit per step, 4 s for 4 digits', () => {
    expect(revealSchedule(4, NUMBER_FLASH_DEFAULTS)).toEqual({
      digitAtMs: [0, 250, 500, 750],
      hideAtMs: 4000,
    })
  })

  it('adds the per-digit extra beyond 4 digits', () => {
    expect(revealSchedule(6, NUMBER_FLASH_DEFAULTS).hideAtMs).toBe(5000)
    expect(revealSchedule(3, NUMBER_FLASH_DEFAULTS).hideAtMs).toBe(4000)
  })

  it('all-at-once schedule shows every digit at 0', () => {
    expect(revealSchedule(5, { ...NUMBER_FLASH_DEFAULTS, revealMode: 'all' }).digitAtMs).toEqual([
      0, 0, 0, 0, 0,
    ])
  })

  it('clamps display so the full number shows ≥ 1 s', () => {
    // last digit appears at 11 × 800 = 8800 ms; base display would be 8000 ms
    const s = revealSchedule(12, { ...NUMBER_FLASH_DEFAULTS, revealMsPerDigit: 800 })
    expect(s.hideAtMs).toBe(9800)
  })

  it('visibleDigits counts digits whose time has come', () => {
    const sch = revealSchedule(4, NUMBER_FLASH_DEFAULTS)
    expect(visibleDigits(sch, 0)).toBe(1)
    expect(visibleDigits(sch, 499)).toBe(2)
    expect(visibleDigits(sch, 5000)).toBe(4)
  })

  it('scoreFlash ignores whitespace and requires exact digits', () => {
    expect(scoreFlash('4819', ' 48 19 ').exact).toBe(true)
    expect(scoreFlash('4819', '4818').exact).toBe(false)
  })

  it('summary', () => {
    const mk = (len: number, success: boolean): RoundRecord => ({
      id: `${len}${success}`,
      gameId: 'number-flash',
      at: 0,
      sessionId: null,
      success,
      level: len,
      accuracy: success ? 1 : 0.5,
      durationMs: 1,
      metrics: { length: len, correct: 0 },
    })
    const s = summarizeNumberFlash([mk(4, true), mk(5, true), mk(6, false)])
    expect(s.headline).toBe('longest 5')
    expect(s.stats).toEqual([
      { label: 'Rounds', value: '3' },
      { label: 'Longest correct', value: '5 digits' },
      { label: 'Last length', value: '6' },
      { label: 'Success (last 20)', value: '67%' },
    ])
    expect(summarizeNumberFlash([]).headline).toBe('not played')
    expect(summarizeNumberFlash([mk(4, false)]).headline).toBe('no correct answer yet')
  })

  it('reveal speed explains the 1-second rule (Q005)', () => {
    const f = NUMBER_FLASH_FIELDS.find((x) => x.key === 'revealMsPerDigit')!
    expect(f.help).toContain('at least 1 s')
  })
})
