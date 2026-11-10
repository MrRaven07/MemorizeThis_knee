import { describe, expect, it } from 'vitest'
import { createRng, randomDigits } from './rng'

describe('createRng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()])
  })

  it('next stays in [0, 1)', () => {
    const r = createRng(9)
    for (let i = 0; i < 1000; i++) {
      const v = r.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('int stays inside inclusive bounds and hits both ends', () => {
    const r = createRng(1)
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i++) {
      const v = r.int(3, 5)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(5)
      seen.add(v)
    }
    expect([...seen].sort()).toEqual([3, 4, 5])
  })

  it('pick returns an element of the list', () => {
    const items = ['a', 'b', 'c'] as const
    expect(items).toContain(createRng(4).pick(items))
  })

  it('shuffle returns a permutation and does not mutate input', () => {
    const input = [1, 2, 3, 4, 5]
    const out = createRng(7).shuffle(input)
    expect(input).toEqual([1, 2, 3, 4, 5])
    expect([...out].sort()).toEqual(input)
  })
})

describe('randomDigits', () => {
  it('returns only digits of the requested length', () => {
    expect(randomDigits(createRng(3), 25)).toMatch(/^\d{25}$/)
    expect(randomDigits(createRng(3), 0)).toBe('')
  })
})
