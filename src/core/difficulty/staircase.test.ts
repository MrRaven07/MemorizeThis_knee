import { describe, expect, it } from 'vitest'
import { clampStaircase, initStaircase, stepStaircase, type StaircaseConfig } from './staircase'

const cfg: StaircaseConfig = {
  start: 4,
  min: 3,
  max: 6,
  upAfter: 3,
  upStep: 1,
  downAfter: 1,
  downStep: 1,
}

describe('staircase', () => {
  it('rises after upAfter correct answers in a row and resets the streak', () => {
    let s = initStaircase(cfg)
    s = stepStaircase(s, cfg, true)
    s = stepStaircase(s, cfg, true)
    expect(s.level).toBe(4)
    s = stepStaircase(s, cfg, true)
    expect(s).toEqual({ level: 5, streakRight: 0, streakWrong: 0 })
  })

  it('a wrong answer lowers by downStep and resets the right-streak', () => {
    const s = stepStaircase(stepStaircase(initStaircase(cfg), cfg, true), cfg, false)
    expect(s).toEqual({ level: 3, streakRight: 0, streakWrong: 0 })
  })

  it('never leaves [min, max]', () => {
    let s = { level: 3, streakRight: 0, streakWrong: 0 }
    s = stepStaircase(s, cfg, false)
    expect(s.level).toBe(3)
    s = { level: 6, streakRight: 2, streakWrong: 0 }
    s = stepStaircase(s, cfg, true)
    expect(s.level).toBe(6)
  })

  it('upStep 2 jumps two levels', () => {
    const c2 = { ...cfg, max: 30, upStep: 2 }
    let s = initStaircase(c2)
    for (let i = 0; i < 3; i++) s = stepStaircase(s, c2, true)
    expect(s.level).toBe(6)
  })

  it('downAfter 2 needs two misses in a row', () => {
    const c = { ...cfg, downAfter: 2 }
    let s = stepStaircase(initStaircase(c), c, false)
    expect(s).toEqual({ level: 4, streakRight: 0, streakWrong: 1 })
    s = stepStaircase(s, c, false)
    expect(s).toEqual({ level: 3, streakRight: 0, streakWrong: 0 })
  })

  it('does not mutate the input state', () => {
    const s = initStaircase(cfg)
    stepStaircase(s, cfg, true)
    expect(s).toEqual({ level: 4, streakRight: 0, streakWrong: 0 })
  })

  it('clamp pulls an out-of-range saved level back inside', () => {
    expect(clampStaircase({ level: 99, streakRight: 1, streakWrong: 0 }, cfg).level).toBe(6)
    expect(clampStaircase({ level: 1, streakRight: 1, streakWrong: 0 }, cfg).level).toBe(3)
  })
})
