import { beforeEach, describe, expect, it } from 'vitest'
import { createCountdown } from './countdown'

let t = 0
const clock = () => t

describe('createCountdown', () => {
  beforeEach(() => {
    t = 0
  })

  it('counts down against the clock', () => {
    const c = createCountdown(4000, clock)
    t = 1000
    expect(c.remaining()).toBe(3000)
    expect(c.elapsed()).toBe(1000)
    expect(c.progress()).toBeCloseTo(0.25)
  })

  it('pause freezes time and resume continues', () => {
    const c = createCountdown(4000, clock)
    t = 1000
    c.pause()
    expect(c.isPaused()).toBe(true)
    t = 5000
    expect(c.remaining()).toBe(3000)
    c.resume()
    t = 6000
    expect(c.remaining()).toBe(2000)
  })

  it('pausing twice or resuming while running is harmless', () => {
    const c = createCountdown(4000, clock)
    c.resume()
    t = 1000
    c.pause()
    t = 2000
    c.pause()
    c.resume()
    t = 3000
    expect(c.remaining()).toBe(2000)
  })

  it('is done at zero and never goes negative', () => {
    const c = createCountdown(4000, clock)
    t = 9000
    expect(c.isDone()).toBe(true)
    expect(c.remaining()).toBe(0)
    expect(c.progress()).toBe(1)
  })

  it('a zero duration is immediately done', () => {
    const c = createCountdown(0, clock)
    expect(c.isDone()).toBe(true)
    expect(c.progress()).toBe(1)
  })
})
