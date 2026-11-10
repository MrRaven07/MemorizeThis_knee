import { describe, expect, it } from 'vitest'
import { addCard, createDeckData } from './deck'
import { deckStats } from './stats'
import type { CardProgress, Deck } from './types'

function deck(n: number): Deck {
  let d = createDeckData('x', 0)
  for (let i = 0; i < n; i++) d = addCard(d, String(i).padStart(2, '0'), `w${i}`)
  return d
}
const prog = (box: CardProgress['box'], knew: number, missed: number): CardProgress => ({
  box,
  knew,
  missed,
  lastAnsweredAt: 1,
})

describe('deckStats', () => {
  it('no answers: success is null, nothing weak', () => {
    expect(deckStats(deck(3), 'forward')).toEqual({
      total: 3,
      knownWell: 0,
      successRate: null,
      weakest: [],
    })
  })

  it('counts known-well, success and the weakest cards', () => {
    const d = deck(14)
    const ids = d.cards.map((c) => c.id)
    const forward: Record<string, CardProgress> = {
      [ids[0]!]: prog(5, 9, 1),
      [ids[1]!]: prog(4, 4, 1),
      [ids[2]!]: prog(1, 1, 4), // 20%
      [ids[3]!]: prog(1, 1, 1), // only 2 answers → not ranked
      [ids[4]!]: prog(1, 2, 8), // 20%, more misses → first
    }
    for (let i = 5; i < 14; i++) forward[ids[i]!] = prog(2, 2, 2) // 50%
    const s = deckStats({ ...d, progress: { forward, reverse: {} } }, 'forward')
    expect(s.total).toBe(14)
    expect(s.knownWell).toBe(2)
    expect(s.successRate).toBeCloseTo((9 + 4 + 1 + 1 + 2 + 18) / (10 + 5 + 5 + 2 + 10 + 36))
    expect(s.weakest).toHaveLength(10)
    expect(s.weakest[0]!.card.id).toBe(ids[4])
    expect(s.weakest[1]!.card.id).toBe(ids[2])
    expect(s.weakest.some((w) => w.card.id === ids[3])).toBe(false)
    expect(
      deckStats({ ...d, progress: { forward, reverse: {} } }, 'reverse').successRate,
    ).toBeNull()
  })
})
