import type { Card, CardProgress, Deck, Direction, ParseError, ParseResult } from './types'

/** Pure deck operations. Each returns a new deck; the input is never mutated. */

const clean = (s: string) => s.normalize('NFC').trim()
const newId = () => globalThis.crypto.randomUUID()

export const DEFAULT_PROGRESS: CardProgress = { box: 1, knew: 0, missed: 0, lastAnsweredAt: null }

export function createDeckData(name: string, now: number): Deck {
  return {
    id: newId(),
    name: clean(name) || 'Untitled deck',
    createdAt: now,
    cards: [],
    progress: { forward: {}, reverse: {} },
  }
}

export function addCard(deck: Deck, input: string, output: string): Deck {
  return {
    ...deck,
    cards: [...deck.cards, { id: newId(), input: clean(input), output: clean(output) }],
  }
}

/** Keeps the card's id — and therefore its progress (question 010). */
export function updateCard(deck: Deck, id: string, input: string, output: string): Deck {
  return {
    ...deck,
    cards: deck.cards.map((c) =>
      c.id === id ? { id, input: clean(input), output: clean(output) } : c,
    ),
  }
}

export function removeCard(deck: Deck, id: string): Deck {
  const drop = (m: Record<string, CardProgress>) => {
    const { [id]: _removed, ...rest } = m
    return rest
  }
  return {
    ...deck,
    cards: deck.cards.filter((c) => c.id !== id),
    progress: { forward: drop(deck.progress.forward), reverse: drop(deck.progress.reverse) },
  }
}

export function progressOf(deck: Deck, dir: Direction, id: string): CardProgress {
  return deck.progress[dir][id] ?? DEFAULT_PROGRESS
}

export interface ImportPlan {
  added: { input: string; output: string }[]
  changed: { id: string; input: string; from: string; to: string }[]
  unchanged: number
  errors: ParseError[]
}

export function planImport(deck: Deck, parsed: ParseResult): ImportPlan {
  const byInput = new Map<string, Card>(deck.cards.map((c) => [c.input, c]))
  const plan: ImportPlan = { added: [], changed: [], unchanged: 0, errors: parsed.errors }
  for (const p of parsed.pairs) {
    const existing = byInput.get(p.input)
    if (!existing) plan.added.push({ input: p.input, output: p.output })
    else if (existing.output === p.output) plan.unchanged++
    else plan.changed.push({ id: existing.id, input: p.input, from: existing.output, to: p.output })
  }
  return plan
}

/** Writes an import plan. Refuses plans with errors (nothing partial is ever written). */
export function applyImport(deck: Deck, plan: ImportPlan, mode: 'replace' | 'keep'): Deck {
  if (plan.errors.length > 0) throw new Error('Cannot import a file with errors')
  let next = deck
  if (mode === 'replace') {
    for (const c of plan.changed) next = updateCard(next, c.id, c.input, c.to)
  }
  for (const a of plan.added) next = addCard(next, a.input, a.output)
  return next
}
