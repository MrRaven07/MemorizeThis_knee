import { describe, expect, it } from 'vitest'
import { createRng } from '@/core/random/rng'
import {
  createSmartSession,
  INTERVALS,
  nextBox,
  nextSmart,
  recordSmart,
  shuffleOrder,
  type SmartSession,
} from './scheduler'

/** Runs the smart scheduler; `answer(id, step)` decides knew/missed. Returns the order shown. */
function simulate(
  ids: string[],
  boxes: Record<string, number>,
  steps: number,
  answer: (id: string, step: number) => boolean,
) {
  let s: SmartSession = createSmartSession()
  const shown: string[] = []
  for (let step = 0; step < steps; step++) {
    const id = nextSmart(s, ids, (x) => boxes[x]!)
    const knew = answer(id, step)
    boxes[id] = nextBox(boxes[id]!, knew)
    s = recordSmart(s, id, knew, ids.length)
    shown.push(id)
  }
  return shown
}

describe('scheduler', () => {
  it('intervals and box moves', () => {
    expect(INTERVALS).toEqual([1, 3, 9, 27, 81])
    expect(nextBox(1, true)).toBe(2)
    expect(nextBox(5, true)).toBe(5)
    expect(nextBox(4, false)).toBe(1)
  })

  it('no card starves; weak cards come up more often', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `c${i}`)
    const boxes: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 5]))
    boxes.c7 = 1
    const shown = simulate(ids, boxes, 400, () => true)
    expect(new Set(shown).size).toBe(20)
    const first50 = shown.slice(0, 50)
    const count = (id: string) => first50.filter((x) => x === id).length
    const maxBox5 = Math.max(...ids.filter((id) => id !== 'c7').map(count))
    expect(count('c7')).toBeGreaterThan(maxBox5)
    expect(shown[0]).toBe('c7')
  })

  it('a missed card comes back after exactly 3 others', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `c${i}`)
    const boxes: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 3]))
    let missedAt = -1
    let missedId = ''
    const shown = simulate(ids, boxes, 30, (id, step) => {
      if (step === 12) {
        missedAt = step
        missedId = id
        return false
      }
      return true
    })
    expect(shown.slice(missedAt + 1, missedAt + 4)).not.toContain(missedId)
    expect(shown[missedAt + 4]).toBe(missedId)
  })

  it('with fewer than 3 other cards the miss comes back after all of them', () => {
    const boxes = { a: 1, b: 1 }
    const shown = simulate(['a', 'b'], boxes, 3, (id, step) => !(step === 0 && id === 'a'))
    expect(shown).toEqual(['a', 'b', 'a'])
  })

  it('is deterministic; ties go to the lower box, then deck order', () => {
    const s = createSmartSession()
    const boxes: Record<string, number> = { x: 2, y: 2, z: 2 }
    expect(nextSmart(s, ['x', 'y', 'z'], (id) => boxes[id]!)).toBe('x')
    expect(nextSmart(s, ['x', 'y', 'z'], (id) => boxes[id]!)).toBe('x')
    expect(nextSmart(s, ['x', 'y', 'z'], (id) => ({ x: 3, y: 2, z: 2 })[id]!)).toBe('y')
  })

  it('shuffleOrder is a seeded permutation', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `c${i}`)
    const a = shuffleOrder(createRng(1), ids)
    expect([...a].sort()).toEqual([...ids].sort())
    expect(shuffleOrder(createRng(1), ids)).toEqual(a)
    expect(shuffleOrder(createRng(2), ids)).not.toEqual(a)
  })

  it('no card reappears within K + 1 consecutive draws (K = 3)', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `c${i}`)
    const boxes: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 5]))
    const shown = simulate(ids, boxes, 80, (_id, step) => step % 7 !== 3)
    const violations = shown.filter((id, i) => shown.slice(Math.max(0, i - 3), i).includes(id))
    expect(violations).toEqual([])
  })

  it('a missed card returns after at least 3 others even with a pile-up', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `c${i}`)
    const boxes: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 1]))
    const alwaysMissed = new Set(['c0', 'c1', 'c2', 'c3', 'c4'])
    const shown = simulate(ids, boxes, 200, (id) => !alwaysMissed.has(id))
    const gaps = shown.flatMap((id, i) => {
      const prev = shown.slice(0, i).lastIndexOf(id)
      return alwaysMissed.has(id) && prev >= 0 ? [i - prev - 1] : []
    })
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(3)
  })

  it('no card starves even when several cards are always missed', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `c${i}`)
    const boxes: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 1]))
    const alwaysMissed = new Set(['c0', 'c1', 'c2', 'c3'])
    const shown = simulate(ids, boxes, 400, (id) => !alwaysMissed.has(id))
    for (const id of ids) expect(shown.filter((x) => x === id).length).toBeGreaterThan(10)
    // after a warm-up, the 6 known cards together get at least 1 of every 4 draws
    const steady = shown.slice(40)
    expect(steady.filter((x) => !alwaysMissed.has(x)).length).toBeGreaterThanOrEqual(
      steady.length / 4,
    )
  })

  it('everything missed: every card is still seen', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `c${i}`)
    const boxes: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 1]))
    const shown = simulate(ids, boxes, 200, () => false)
    expect(new Set(shown).size).toBe(8)
  })
})
