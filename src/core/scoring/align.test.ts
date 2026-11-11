import { describe, expect, it } from 'vitest'
import { alignSequences, alignStrings } from './align'

describe('alignStrings', () => {
  it('a skipped digit only costs that digit', () => {
    const r = alignStrings('12345', '1245')
    expect(r.ops.map((o) => o.kind)).toEqual(['match', 'match', 'missing', 'match', 'match'])
    expect(r.correct).toBe(4)
    expect(r.accuracy).toBeCloseTo(0.8)
    expect(r.exact).toBe(false)
  })

  it('an extra digit is penalised', () => {
    const r = alignStrings('123', '1923')
    expect(r.ops.map((o) => o.kind)).toEqual(['match', 'extra', 'match', 'match'])
    expect(r.accuracy).toBeCloseTo(0.75)
  })

  it('a wrong digit is a substitution', () => {
    expect(alignStrings('123', '193').ops[1]).toEqual({
      kind: 'substitute',
      expected: '2',
      actual: '9',
    })
  })

  it('exact match and empty strings', () => {
    expect(alignStrings('8080', '8080')).toMatchObject({ exact: true, accuracy: 1, correct: 4 })
    expect(alignStrings('', '')).toMatchObject({ exact: true, accuracy: 1 })
    expect(alignStrings('12', '')).toMatchObject({ exact: false, accuracy: 0, correct: 0 })
  })

  it('treats decomposed and composed diacritics as equal', () => {
    // second string uses s + U+0326 (combining comma below)
    expect(alignStrings('sanie ș', 'sanie ș').exact).toBe(true)
  })

  it('splits by code point, not UTF-16 unit', () => {
    const r = alignStrings('a😀b', 'a😀b')
    expect(r.expectedLength).toBe(3)
    expect(r.exact).toBe(true)
  })
})

describe('alignSequences (generic)', () => {
  it('a skipped item only costs that item', () => {
    const r = alignSequences([1, 2, 3, 4, 5], [1, 2, 4, 5])
    expect(r.ops.map((o) => o.kind)).toEqual(['match', 'match', 'missing', 'match', 'match'])
    expect(r.ops[2]).toEqual({ kind: 'missing', expected: 3 })
    expect(r.accuracy).toBeCloseTo(0.8)
    expect(r.exact).toBe(false)
  })

  it('extra and substitute items', () => {
    expect(alignSequences([1, 2, 3], [1, 9, 2, 3]).ops[1]).toEqual({ kind: 'extra', actual: 9 })
    expect(alignSequences([1, 2, 3], [1, 9, 3]).ops[1]).toEqual({
      kind: 'substitute',
      expected: 2,
      actual: 9,
    })
  })

  it('empty arrays and a custom equals', () => {
    expect(alignSequences([], [])).toMatchObject({ exact: true, accuracy: 1, correct: 0 })
    const r = alignSequences([{ v: 1 }, { v: 2 }], [{ v: 1 }, { v: 2 }], (a, b) => a.v === b.v)
    expect(r.exact).toBe(true)
    expect(r.ops[0]).toEqual({ kind: 'match', item: { v: 1 } })
  })
})
