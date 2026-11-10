import type { StaircaseConfig } from '@/core/difficulty/staircase'
import type { Rng } from '@/core/random/rng'
import type { GameSettings, GameSummary, RoundRecord, SettingField } from '@/games/types'

/**
 * Card Match: the classic pairs game, scored against the fewest possible
 * moves, with "memory mistakes" counted separately from bad luck.
 * Spec §6.5, question 009.
 */
export const CARD_MATCH_ID = 'card-match'
export const SYMBOL_COUNT = 18

export interface CardMatchSettings extends GameSettings {
  previewSecondsPerPair: number
}

export const CARD_MATCH_DEFAULTS: CardMatchSettings = { previewSecondsPerPair: 0.5 }

export const CARD_MATCH_FIELDS: SettingField[] = [
  {
    key: 'previewSecondsPerPair',
    label: 'Preview per pair',
    type: 'number',
    min: 0,
    max: 3,
    step: 0.25,
    unit: 's',
    help: '0 = no preview (classic exploration game)',
  },
]

export interface CardLevel {
  rows: number
  cols: number
}

export const CARD_LEVELS: readonly CardLevel[] = [
  { rows: 2, cols: 3 },
  { rows: 3, cols: 4 },
  { rows: 4, cols: 4 },
  { rows: 4, cols: 5 },
  { rows: 4, cols: 6 },
  { rows: 6, cols: 6 },
]

export const CARD_STAIRCASE: StaircaseConfig = {
  start: 1,
  min: 1,
  max: CARD_LEVELS.length,
  upAfter: 3,
  upStep: 1,
  downAfter: 1,
  downStep: 1,
}

export function cardLevelInfo(level: number): CardLevel {
  const i = Math.min(CARD_LEVELS.length, Math.max(1, Math.round(level))) - 1
  return CARD_LEVELS[i]!
}

export const pairsOf = (l: CardLevel) => (l.rows * l.cols) / 2

export function previewMs(level: number, secondsPerPair: number): number {
  return Math.round(pairsOf(cardLevelInfo(level)) * secondsPerPair * 1000)
}

export function dealCards(rng: Rng, pairs: number): number[] {
  const symbols = rng.shuffle(Array.from({ length: SYMBOL_COUNT }, (_, i) => i)).slice(0, pairs)
  return rng.shuffle([...symbols, ...symbols])
}

export interface Board {
  cards: number[]
  matched: boolean[]
  /** face-up at any earlier moment (the preview counts) */
  seen: boolean[]
  first: number | null
  /** a mismatched pair still showing (flip-back pending) */
  pending: [number, number] | null
  moves: number
  memoryMistakes: number
}

export type FlipEvent = 'first' | 'match' | 'mismatch' | 'ignored'

export function createBoard(cards: number[], previewed: boolean): Board {
  return {
    cards: [...cards],
    matched: cards.map(() => false),
    seen: cards.map(() => previewed),
    first: null,
    pending: null,
    moves: 0,
    memoryMistakes: 0,
  }
}

export function clearPending(board: Board): Board {
  return board.pending ? { ...board, pending: null } : board
}

function partner(board: Board, i: number): number {
  return board.cards.findIndex((c, j) => j !== i && c === board.cards[i])
}

export function flip(
  input: Board,
  index: number,
): { board: Board; event: FlipEvent; mistake: boolean } {
  const board = clearPending(input)
  if (index < 0 || index >= board.cards.length || board.matched[index] || board.first === index) {
    return { board, event: 'ignored', mistake: false }
  }

  if (board.first === null) {
    const seen = [...board.seen]
    seen[index] = true
    return { board: { ...board, first: index, seen }, event: 'first', mistake: false }
  }

  const a = board.first
  const b = index
  const p = partner(board, a)
  const moves = board.moves + 1
  const seen = [...board.seen]
  seen[b] = true

  if (b === p) {
    const matched = [...board.matched]
    matched[a] = true
    matched[b] = true
    return {
      board: { ...board, matched, seen, first: null, moves },
      event: 'match',
      mistake: false,
    }
  }

  // Evaluated with what was seen BEFORE this move's second reveal (question 009).
  const mistake = (board.seen[p] ?? false) || (board.seen[b] ?? false)
  return {
    board: {
      ...board,
      seen,
      first: null,
      pending: [a, b],
      moves,
      memoryMistakes: board.memoryMistakes + (mistake ? 1 : 0),
    },
    event: 'mismatch',
    mistake,
  }
}

export function faceUp(board: Board, i: number): boolean {
  return (
    board.matched[i] === true ||
    board.first === i ||
    (board.pending !== null && board.pending.includes(i))
  )
}

export function isComplete(board: Board): boolean {
  return board.matched.every(Boolean)
}

export function summarizeCardMatch(rounds: RoundRecord[]): GameSummary {
  if (rounds.length === 0) return { headline: 'not played', stats: [] }
  const wins = rounds.filter((r) => r.success)
  const largest = wins.reduce<RoundRecord | null>(
    (best, r) => (!best || (r.metrics.pairs ?? 0) > (best.metrics.pairs ?? 0) ? r : best),
    null,
  )
  const size = largest ? `${largest.metrics.rows}×${largest.metrics.cols}` : null
  const last10 = rounds.slice(-10)
  const avgExtra = last10.reduce((a, r) => a + (r.metrics.extraMoves ?? 0), 0) / last10.length
  const last20 = rounds.slice(-20)
  const perfectPct = Math.round((last20.filter((r) => r.success).length / last20.length) * 100)
  return {
    headline: size === null ? 'no perfect round yet' : `largest ${size}`,
    stats: [
      { label: 'Rounds', value: String(rounds.length) },
      { label: 'Largest cleared', value: size ?? '—' },
      { label: 'Extra moves (avg, last 10)', value: avgExtra.toFixed(1) },
      { label: 'Perfect rounds (last 20)', value: `${perfectPct}%` },
    ],
  }
}
