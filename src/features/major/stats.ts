import { progressOf } from './deck'
import type { Card, Deck, Direction } from './types'

export interface DeckStats {
  total: number
  /** cards in box 4 or 5 */
  knownWell: number
  /** knew / (knew + missed) over all cards; null with no answers */
  successRate: number | null
  /** up to 10 cards with ≥ 3 answers, lowest success first (ties: more misses first) */
  weakest: { card: Card; rate: number; answers: number }[]
}

export function deckStats(deck: Deck, dir: Direction): DeckStats {
  let knew = 0
  let missed = 0
  let knownWell = 0
  const ranked: (DeckStats['weakest'][number] & { missed: number })[] = []
  for (const card of deck.cards) {
    const p = progressOf(deck, dir, card.id)
    knew += p.knew
    missed += p.missed
    if (p.box >= 4) knownWell++
    const answers = p.knew + p.missed
    if (answers >= 3) ranked.push({ card, rate: p.knew / answers, answers, missed: p.missed })
  }
  ranked.sort((a, b) => a.rate - b.rate || b.missed - a.missed)
  return {
    total: deck.cards.length,
    knownWell,
    successRate: knew + missed === 0 ? null : knew / (knew + missed),
    weakest: ranked.slice(0, 10).map(({ card, rate, answers }) => ({ card, rate, answers })),
  }
}
