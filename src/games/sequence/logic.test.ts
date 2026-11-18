import { describe, expect, it } from 'vitest'
import { createRng } from '@/core/random/rng'
import { sanitizeSettings } from '@/games/settings'
import type { RoundRecord } from '@/games/types'
import {
  LEAD_MS,
  MAX_LENGTH,
  MIN_ITEM_MS,
  SEQUENCE_DEFAULTS,
  SEQUENCE_FIELDS,
  SEQUENCE_ID,
  bestFor,
  checkTap,
  createSequence,
  gapMs,
  isSuccess,
  itemMs,
  keyToPad,
  padCount,
  playbackAt,
  playbackMs,
  runMetrics,
  startFromBest,
  summarizeSequence,
  timeoutMs,
  totalRecalled,
} from './logic'

function rec(metrics: Record<string, number>, success = true): RoundRecord {
  return {
    id: 'x',
    gameId: SEQUENCE_ID,
    at: 0,
    sessionId: null,
    success,
    level: null,
    accuracy: null,
    durationMs: 1000,
    metrics,
  }
}
const run = (reached: number, pads = 4, startLength = 1) =>
  rec({ reached, pads, startLength, steps: reached === 0 ? 0 : reached - startLength + 1 })

describe('sequence logic', () => {
  it('id, defaults survive sanitizing', () => {
    expect(SEQUENCE_ID).toBe('sequence')
    expect(SEQUENCE_DEFAULTS).toEqual({
      pads: '4',
      feedback: 'both',
      startLength: 1,
      baseMs: 700,
      inputTimeout: 0,
      volume: 60,
    })
    expect(sanitizeSettings(SEQUENCE_DEFAULTS, SEQUENCE_DEFAULTS, SEQUENCE_FIELDS)).toEqual(
      SEQUENCE_DEFAULTS,
    )
    const s = sanitizeSettings(
      { pads: '7', startLength: 500, baseMs: 10, volume: -3, inputTimeout: 99 },
      SEQUENCE_DEFAULTS,
      SEQUENCE_FIELDS,
    )
    expect(s).toMatchObject({ pads: '4', startLength: 50, baseMs: 400, volume: 0, inputTimeout: 10 })
  })

  it('pad count from the select', () => {
    expect(padCount('4')).toBe(4)
    expect(padCount('6')).toBe(6)
    expect(padCount('9')).toBe(9)
    expect(padCount('nonsense')).toBe(4)
  })

  it('input timeout: 0 is off, 1 is raised to the 2 s minimum', () => {
    expect(timeoutMs(0)).toBe(0)
    expect(timeoutMs(1)).toBe(2000)
    expect(timeoutMs(5)).toBe(5000)
  })

  it('a sequence grows append-only; same seed, same sequence', () => {
    const a = createSequence(createRng(7), 4)
    a.growTo(3)
    const first = [a.at(0), a.at(1), a.at(2)]
    for (let i = 0; i < 100; i++) a.grow()
    expect([a.at(0), a.at(1), a.at(2)]).toEqual(first)
    expect(a.length).toBe(103)
    const b = createSequence(createRng(7), 4)
    b.growTo(103)
    for (let i = 0; i < 103; i++) expect(b.at(i)).toBe(a.at(i))
    for (let i = 0; i < 103; i++) {
      expect(a.at(i)).toBeGreaterThanOrEqual(0)
      expect(a.at(i)).toBeLessThan(4)
    }
  })

  it('every pad gets used, and the safety cap is 999', () => {
    const s = createSequence(createRng(3), 9)
    s.growTo(2000)
    expect(s.length).toBe(MAX_LENGTH)
    expect(MAX_LENGTH).toBe(999)
    expect(s.grow()).toBe(false)
    const used = new Set(Array.from({ length: 200 }, (_, i) => s.at(i)))
    expect(used.size).toBe(9)
  })

  it('item time shrinks 15 ms per step down to a 250 ms floor; gap is 30%', () => {
    expect(itemMs(700, 1)).toBe(700)
    expect(itemMs(700, 2)).toBe(685)
    expect(itemMs(700, 31)).toBe(250)
    expect(itemMs(700, 300)).toBe(MIN_ITEM_MS)
    expect(itemMs(1200, 10)).toBe(1065)
    expect(gapMs(700)).toBe(210)
    expect(gapMs(250)).toBe(75)
  })

  it('playback: lead-in, then item i lit for itemMs, dark for the gap', () => {
    const ms = 500
    const slot = ms + gapMs(ms)
    expect(playbackMs(3, ms)).toBe(LEAD_MS + 3 * slot)
    expect(playbackAt(0, 3, ms)).toEqual({ index: -1, lit: false })
    expect(playbackAt(LEAD_MS, 3, ms)).toEqual({ index: 0, lit: true })
    expect(playbackAt(LEAD_MS + ms + 1, 3, ms)).toEqual({ index: 0, lit: false })
    expect(playbackAt(LEAD_MS + slot, 3, ms)).toEqual({ index: 1, lit: true })
    expect(playbackAt(LEAD_MS + 2 * slot + 10, 3, ms)).toEqual({ index: 2, lit: true })
    expect(playbackAt(playbackMs(3, ms), 3, ms)).toEqual({ index: 2, lit: false })
  })

  it('timing at step 300 matches itemMs exactly (no drift, O(1) lookup)', () => {
    const ms = itemMs(700, 300)
    const n = 300
    const slot = ms + gapMs(ms)
    expect(playbackAt(LEAD_MS + 299 * slot + 5, n, ms)).toEqual({ index: 299, lit: true })
    expect(playbackAt(LEAD_MS + 299 * slot - 5, n, ms)).toEqual({ index: 298, lit: false })
    expect(playbackAt(LEAD_MS + 150 * slot + ms - 1, n, ms)).toEqual({ index: 150, lit: true })
  })

  it('checking a tap', () => {
    const s = createSequence(createRng(1), 4)
    s.growTo(2)
    const wrong = (s.at(0) + 1) % 4
    expect(checkTap(s, 0, wrong)).toBe('wrong')
    expect(checkTap(s, 0, s.at(0))).toBe('correct')
    expect(checkTap(s, 1, s.at(1))).toBe('complete')
  })

  it('a simulated perfect run to length 500 never changes earlier items', () => {
    const s = createSequence(createRng(42), 6)
    s.growTo(1)
    const seen: number[] = []
    let reached = 0
    for (let step = 1; s.length <= 500; step++) {
      const earlier = Array.from({ length: seen.length }, (_, i) => s.at(i))
      expect(earlier).toEqual(seen)
      const outcomes = Array.from({ length: s.length }, (_, i) => checkTap(s, i, s.at(i)))
      expect(outcomes.pop()).toBe('complete')
      expect(outcomes.every((o) => o === 'correct')).toBe(true)
      seen.push(s.at(s.length - 1))
      reached = s.length
      if (reached === 500) break
      s.grow()
    }
    expect(reached).toBe(500)
  })

  it('keys: 1–9 and numpad by pad count, Q W A S for 4 pads', () => {
    const k = (key: string, code = '') => ({ key, code })
    expect(keyToPad(k('1'), 4)).toBe(0)
    expect(keyToPad(k('4'), 4)).toBe(3)
    expect(keyToPad(k('5'), 4)).toBeNull()
    expect(keyToPad(k('9'), 9)).toBe(8)
    expect(keyToPad(k('End', 'Numpad1'), 4)).toBe(0)
    expect(keyToPad(k('q'), 4)).toBe(0)
    expect(keyToPad(k('W'), 4)).toBe(1)
    expect(keyToPad(k('a'), 4)).toBe(2)
    expect(keyToPad(k('s'), 4)).toBe(3)
    expect(keyToPad(k('q'), 6)).toBeNull()
    expect(keyToPad(k('x'), 4)).toBeNull()
  })

  it('best for a pad count; start from best − 3', () => {
    const rounds = [run(5, 4), run(12, 4), run(30, 6)]
    expect(bestFor(rounds, 4)).toBe(12)
    expect(bestFor(rounds, 6)).toBe(30)
    expect(bestFor(rounds, 9)).toBeNull()
    expect(bestFor([], 4)).toBeNull()
    expect(startFromBest(12)).toBe(9)
    expect(startFromBest(2)).toBe(1)
    expect(startFromBest(0)).toBe(1)
  })

  it('success: ties or beats the previous best; the first run always counts', () => {
    expect(isSuccess(3, null)).toBe(true)
    expect(isSuccess(0, null)).toBe(true)
    expect(isSuccess(10, 10)).toBe(true)
    expect(isSuccess(11, 10)).toBe(true)
    expect(isSuccess(9, 10)).toBe(false)
  })

  it('run metrics and items recalled', () => {
    expect(runMetrics({ reached: 0, startLength: 5, pads: 4, steps: 0 })).toEqual({
      reached: 0,
      startLength: 5,
      pads: 4,
      steps: 0,
    })
    // lengths 5, 6, 7 repeated correctly = 18 items
    expect(totalRecalled([run(7, 4, 5)])).toBe(18)
    expect(totalRecalled([run(0, 4, 5)])).toBe(0)
  })

  it('summary', () => {
    expect(summarizeSequence([])).toEqual({ headline: 'not played', stats: [] })
    const rounds = [run(5, 4), run(12, 4), run(30, 6), run(0, 4)]
    const s = summarizeSequence(rounds)
    expect(s.headline).toBe('best 30')
    expect(s.stats).toEqual([
      { label: 'Runs', value: '4' },
      { label: 'Best (4 pads)', value: '12' },
      { label: 'Best (6 pads)', value: '30' },
      { label: 'Best (9 pads)', value: '—' },
      { label: 'Average (last 10)', value: '11.8' },
      { label: 'Total items recalled', value: String(15 + 78 + 465) },
    ])
  })
})
