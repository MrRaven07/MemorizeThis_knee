import type { Card } from './types'

export interface SelectionProblem {
  item: string
  reason: 'invalid' | 'no match'
}

const isDigits = (s: string) => /^\d+$/.test(s)

/**
 * Picks cards from text like `30-49`, `00-09, 15, 77`, `luna` (question 010).
 * - `a-b` with ends of the SAME length matches only digit inputs of that
 *   length, numerically in range (so `0-9` never picks `00`–`09`).
 * - Ends of DIFFERENT length match digit inputs of any length numerically.
 * - A single item matches an input exactly.
 * Invalid or unmatched items are reported, never ignored.
 */
export function parseSelection(
  text: string,
  cards: Card[],
): { ids: string[]; problems: SelectionProblem[] } {
  const picked = new Set<string>()
  const problems: SelectionProblem[] = []
  const items = text
    .normalize('NFC')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  for (const item of items) {
    const range = /^(\S+?)\s*-\s*(\S+)$/.exec(item)
    let matches: Card[]
    if (range && !cards.some((c) => c.input === item)) {
      const [, a = '', b = ''] = range
      if (!isDigits(a) || !isDigits(b)) {
        problems.push({ item, reason: 'invalid' })
        continue
      }
      const lo = Math.min(Number(a), Number(b))
      const hi = Math.max(Number(a), Number(b))
      const sameLength = a.length === b.length
      matches = cards.filter(
        (c) =>
          isDigits(c.input) &&
          (!sameLength || c.input.length === a.length) &&
          Number(c.input) >= lo &&
          Number(c.input) <= hi,
      )
    } else {
      matches = cards.filter((c) => c.input === item)
    }
    if (matches.length === 0) problems.push({ item, reason: 'no match' })
    for (const c of matches) picked.add(c.id)
  }

  return { ids: cards.filter((c) => picked.has(c.id)).map((c) => c.id), problems }
}
