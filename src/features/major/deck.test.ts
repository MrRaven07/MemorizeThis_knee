import { describe, expect, it } from 'vitest'
import {
  addCard,
  applyImport,
  createDeckData,
  planImport,
  progressOf,
  removeCard,
  updateCard,
} from './deck'
import { parsePaste } from './parse'
import type { Deck } from './types'

function deckWith(...pairs: [string, string][]): Deck {
  return pairs.reduce((d, [i, o]) => addCard(d, i, o), createDeckData('Test', 0))
}

describe('deck operations', () => {
  it('creates an empty deck', () => {
    const d = createDeckData('  Major RO  ', 5)
    expect(d).toMatchObject({
      name: 'Major RO',
      createdAt: 5,
      cards: [],
      progress: { forward: {}, reverse: {} },
    })
    expect(typeof d.id).toBe('string')
  })

  it('addCard trims and normalizes, and progress defaults to box 1', () => {
    const d = addCard(createDeckData('x', 0), ' 05 ', 'șolz')
    expect(d.cards[0]).toMatchObject({ input: '05', output: 'șolz' })
    expect(progressOf(d, 'forward', d.cards[0]!.id)).toEqual({
      box: 1,
      knew: 0,
      missed: 0,
      lastAnsweredAt: null,
    })
  })

  it('updateCard keeps id and progress; removeCard drops progress', () => {
    let d = deckWith(['00', 'sos'])
    const id = d.cards[0]!.id
    d = {
      ...d,
      progress: {
        ...d.progress,
        forward: { [id]: { box: 3, knew: 2, missed: 0, lastAnsweredAt: 1 } },
      },
    }
    d = updateCard(d, id, '00', 'soare')
    expect(d.cards[0]).toEqual({ id, input: '00', output: 'soare' })
    expect(progressOf(d, 'forward', id).box).toBe(3)
    d = removeCard(d, id)
    expect(d.cards).toEqual([])
    expect(d.progress.forward[id]).toBeUndefined()
  })

  it('does not mutate the original deck', () => {
    const d = deckWith(['00', 'sos'])
    addCard(d, '01', 'sat')
    expect(d.cards).toHaveLength(1)
  })
})

describe('import planning', () => {
  const deck = deckWith(['00', 'sos'], ['02', 'sanie'])
  const parsed = parsePaste('00 - soș\n01 - sat\n02 - sanie')

  it('splits into added, changed and unchanged', () => {
    const plan = planImport(deck, parsed)
    expect(plan.added).toEqual([{ input: '01', output: 'sat' }])
    expect(plan.changed).toEqual([{ id: deck.cards[0]!.id, input: '00', from: 'sos', to: 'soș' }])
    expect(plan.unchanged).toBe(1)
    expect(plan.errors).toEqual([])
  })

  it('replace keeps the id; keep leaves the old output', () => {
    const plan = planImport(deck, parsed)
    const replaced = applyImport(deck, plan, 'replace')
    expect(replaced.cards.find((c) => c.input === '00')).toEqual({
      id: deck.cards[0]!.id,
      input: '00',
      output: 'soș',
    })
    expect(replaced.cards.map((c) => c.input)).toEqual(['00', '02', '01'])
    const kept = applyImport(deck, plan, 'keep')
    expect(kept.cards.find((c) => c.input === '00')!.output).toBe('sos')
    expect(kept.cards).toHaveLength(3)
  })

  it('refuses a plan with errors', () => {
    const plan = planImport(deck, parsePaste('00 - a\nbad line'))
    expect(plan.errors).toHaveLength(1)
    expect(() => applyImport(deck, plan, 'replace')).toThrow()
  })
})
