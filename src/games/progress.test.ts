import { describe, expect, it } from 'vitest'
import { progressLabel } from './progress'

const base = { from: 4, to: 4, streak: 1, upAfter: 3, max: 10 }

describe('progressLabel', () => {
  it('a level change wins', () => {
    expect(progressLabel({ ...base, to: 5 }, true)).toBe('Level 4 → 5')
    expect(progressLabel({ ...base, to: 3 }, false)).toBe('Level 4 → 3')
  })
  it('passed: streak, or max at the top', () => {
    expect(progressLabel(base, true)).toBe('Level 4 (streak 1/3)')
    expect(progressLabel({ ...base, from: 10, to: 10, streak: 0 }, true)).toBe('Level 10 (max)')
  })
  it('not passed: plain, or streak reset when asked', () => {
    expect(progressLabel(base, false)).toBe('Level 4')
    expect(progressLabel(base, false, { reset: true })).toBe('Level 4 (streak reset)')
  })
  it('custom noun', () => {
    expect(progressLabel({ ...base, to: 5 }, true, { noun: 'N' })).toBe('N 4 → 5')
  })
})
