import { describe, expect, it } from 'vitest'
import { parseSelection } from './selection'
import type { Card } from './types'

const single = Array.from({ length: 10 }, (_, i) => String(i))
const double = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0'))
const cards: Card[] = [...single, ...double, 'luna'].map((input) => ({
  id: `id-${input}`,
  input,
  output: 'x',
}))
const inputs = (ids: string[]) => ids.map((id) => id.slice(3))

describe('parseSelection', () => {
  it('same-length ends match only that length', () => {
    expect(inputs(parseSelection('0-9', cards).ids)).toEqual(single)
    expect(inputs(parseSelection('00-09', cards).ids)).toEqual(double.slice(0, 10))
  })

  it('different-length ends match numerically at any length', () => {
    expect(inputs(parseSelection('5-12', cards).ids)).toEqual([
      '5',
      '6',
      '7',
      '8',
      '9',
      '05',
      '06',
      '07',
      '08',
      '09',
      '10',
      '11',
      '12',
    ])
  })

  it('single items match exactly; duplicates removed; deck order kept', () => {
    expect(inputs(parseSelection('77, 15, luna, 15', cards).ids)).toEqual(['15', '77', 'luna'])
  })

  it('reports invalid and unmatched items', () => {
    const r = parseSelection('30-2x, 500, 01', cards)
    expect(r.problems).toEqual([
      { item: '30-2x', reason: 'invalid' },
      { item: '500', reason: 'no match' },
    ])
    expect(inputs(r.ids)).toEqual(['01'])
  })

  it('reversed ranges work and blank input selects nothing', () => {
    expect(inputs(parseSelection('03-01', cards).ids)).toEqual(['01', '02', '03'])
    expect(parseSelection('  ', cards)).toEqual({ ids: [], problems: [] })
  })
})
