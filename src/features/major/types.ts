/** Major System (or any input → output) flashcards. Spec §6.6, question 010. */

export interface Card {
  /** stable id (crypto.randomUUID) — progress is keyed by it, never by text */
  id: string
  input: string
  output: string
}

export type Box = 1 | 2 | 3 | 4 | 5

export interface CardProgress {
  box: Box
  knew: number
  missed: number
  /** epoch ms */
  lastAnsweredAt: number | null
}

/** forward = see input, recall output; reverse = see output, recall input */
export type Direction = 'forward' | 'reverse'

export interface Deck {
  id: string
  name: string
  /** epoch ms */
  createdAt: number
  cards: Card[]
  progress: Record<Direction, Record<string, CardProgress>>
}

export interface ParsedPair {
  input: string
  output: string
  /** 1-based line in the original text (for JSON: item number) */
  line: number
}

export interface ParseError {
  line: number
  message: string
}

export interface ParseResult {
  pairs: ParsedPair[]
  errors: ParseError[]
}
