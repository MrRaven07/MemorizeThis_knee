import { describe, expect, it } from 'vitest'
import { clampStaircase, type StaircaseConfig, type StaircaseState } from './staircase'

const cfg: StaircaseConfig = { start: 4, min: 3, max: 30, upAfter: 3, upStep: 1, downAfter: 1, downStep: 1 }

describe('clampStaircase with corrupted saved data', () => {
  it.each([
    [{ level: 'abc', streakRight: 1, streakWrong: 0 }],
    [{ level: NaN, streakRight: 0, streakWrong: 0 }],
    [{ level: null, streakRight: 'x', streakWrong: undefined }],
    [{}],
  ])('%j falls back to a valid state', (saved) => {
    const s = clampStaircase(saved as unknown as StaircaseState, cfg)
    expect(s.level).toBe(4)
    expect(Number.isFinite(s.streakRight)).toBe(true)
    expect(Number.isFinite(s.streakWrong)).toBe(true)
  })
})
