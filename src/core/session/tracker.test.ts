import { describe, expect, it } from 'vitest'
import { createTracker, IDLE_TIMEOUT_MS, isExpired } from './tracker'

describe('createTracker', () => {
  it('counts only active spans, per game', () => {
    let t = 0
    const tr = createTracker(() => t)
    tr.start('long-number')
    t = 5000
    tr.stop()
    t = 9000
    tr.start('number-flash')
    t = 10000
    expect(tr.isActive()).toBe(true)
    expect(tr.activeMs()).toBe(6000)
    expect(tr.perGameMs()).toEqual({ 'long-number': 5000, 'number-flash': 1000 })
  })

  it('continues from saved totals', () => {
    let t = 0
    const tr = createTracker(() => t, { activeMs: 60_000, perGameMs: { 'long-number': 60_000 } })
    tr.start('long-number')
    t = 1000
    tr.stop()
    expect(tr.activeMs()).toBe(61_000)
    expect(tr.perGameMs()).toEqual({ 'long-number': 61_000 })
  })

  it('starting while active switches game without losing time', () => {
    let t = 0
    const tr = createTracker(() => t)
    tr.start('a')
    t = 1000
    tr.start('b')
    t = 3000
    tr.stop()
    expect(tr.perGameMs()).toEqual({ a: 1000, b: 2000 })
    expect(tr.isActive()).toBe(false)
  })
})

describe('isExpired', () => {
  it('expires after 30 idle minutes', () => {
    expect(IDLE_TIMEOUT_MS).toBe(30 * 60_000)
    expect(isExpired(0, 30 * 60_000 - 1)).toBe(false)
    expect(isExpired(0, 30 * 60_000)).toBe(true)
  })
})
