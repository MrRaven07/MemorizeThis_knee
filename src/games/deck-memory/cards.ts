/**
 * A standard 52-card deck. id 0–51: suit = floor(id / 13) in the order
 * spades, hearts, diamonds, clubs; rank = id % 13 in the order A 2–10 J Q K.
 */
export const CARD_COUNT = 52

export const SUITS = [
  { letter: 'S', symbol: '♠', name: 'spades', red: false },
  { letter: 'H', symbol: '♥', name: 'hearts', red: true },
  { letter: 'D', symbol: '♦', name: 'diamonds', red: true },
  { letter: 'C', symbol: '♣', name: 'clubs', red: false },
] as const

export const RANKS = [
  { label: 'A', name: 'Ace' },
  { label: '2', name: 'Two' },
  { label: '3', name: 'Three' },
  { label: '4', name: 'Four' },
  { label: '5', name: 'Five' },
  { label: '6', name: 'Six' },
  { label: '7', name: 'Seven' },
  { label: '8', name: 'Eight' },
  { label: '9', name: 'Nine' },
  { label: '10', name: 'Ten' },
  { label: 'J', name: 'Jack' },
  { label: 'Q', name: 'Queen' },
  { label: 'K', name: 'King' },
] as const

export const cardSuit = (id: number) => SUITS[Math.floor(id / 13)]!
export const cardRank = (id: number) => RANKS[id % 13]!
export const isRed = (id: number) => cardSuit(id).red
export const cardCode = (id: number) => `${cardRank(id).label}${cardSuit(id).letter}`
export const cardName = (id: number) => `${cardRank(id).name} of ${cardSuit(id).name}`

const SUIT_INPUT: Record<string, number> = {
  S: 0,
  H: 1,
  D: 2,
  C: 3,
  '♠': 0,
  '♥': 1,
  '♦': 2,
  '♣': 3,
}
const RANK_INPUT: Record<string, number> = Object.fromEntries([
  ...RANKS.map((r, i) => [r.label, i] as const),
  ['T', 9],
])

/** `AS`, `10h`, `ts`, `Q♦` → card id; anything else → null. Case-insensitive. */
export function parseCode(token: string): number | null {
  const t = token
    .trim()
    .toUpperCase()
    .replace(/[\uFE0E\uFE0F]/gu, '') // variation selectors (♥️ on phones)
  const m = /^(10|[2-9AJQKT])(.)$/u.exec(t)
  if (!m) return null
  const rank = RANK_INPUT[m[1]!]
  const suit = SUIT_INPUT[m[2]!]
  return rank === undefined || suit === undefined ? null : suit * 13 + rank
}

export interface CodeProblem {
  token: string
  reason: 'invalid' | 'used'
}

/**
 * Parses typed codes (separated by spaces, commas or semicolons). Cards already
 * `used` — or repeated within the text — are reported, never added twice.
 */
export function parseCodes(
  text: string,
  used: ReadonlySet<number>,
): { ids: number[]; problems: CodeProblem[] } {
  const ids: number[] = []
  const problems: CodeProblem[] = []
  const taken = new Set(used)
  for (const token of text.split(/[\s,;]+/u).filter(Boolean)) {
    const id = parseCode(token)
    if (id === null) problems.push({ token, reason: 'invalid' })
    else if (taken.has(id)) problems.push({ token, reason: 'used' })
    else {
      taken.add(id)
      ids.push(id)
    }
  }
  return { ids, problems }
}
