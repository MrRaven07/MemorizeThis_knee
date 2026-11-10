import { describe, expect, it } from 'vitest'
import { createRng } from '@/core/random/rng'
import { sanitizeSettings } from '@/games/settings'
import type { RoundRecord } from '@/games/types'
import {
  CARD_LEVELS,
  CARD_MATCH_DEFAULTS,
  CARD_MATCH_FIELDS,
  CARD_MATCH_ID,
  CARD_STAIRCASE,
  cardLevelInfo,
  createBoard,
  dealCards,
  faceUp,
  flip,
  isComplete,
  pairsOf,
  previewMs,
  summarizeCardMatch,
  type Board,
} from './logic'

/** Apply a sequence of flips, returning the final board and whether each flip was a mistake. */
function play(board: Board, flips: number[]) {
  const mistakes: boolean[] = []
  const events: string[] = []
  let b = board
  for (const i of flips) {
    const r = flip(b, i)
    b = r.board
    mistakes.push(r.mistake)
    events.push(r.event)
  }
  return { board: b, mistakes, events }
}

describe('card match logic', () => {
  it('levels, staircase, settings', () => {
    expect(CARD_MATCH_ID).toBe('card-match')
    expect(CARD_LEVELS.map((l) => `${l.rows}x${l.cols}`)).toEqual([
      '2x3',
      '3x4',
      '4x4',
      '4x5',
      '4x6',
      '6x6',
    ])
    expect(CARD_STAIRCASE).toEqual({
      start: 1,
      min: 1,
      max: 6,
      upAfter: 3,
      upStep: 1,
      downAfter: 1,
      downStep: 1,
    })
    expect(cardLevelInfo(99)).toBe(CARD_LEVELS[5])
    expect(pairsOf(CARD_LEVELS[5]!)).toBe(18)
    expect(previewMs(1, 0.5)).toBe(1500)
    expect(previewMs(6, 0.5)).toBe(9000)
    expect(previewMs(3, 0)).toBe(0)
    expect(sanitizeSettings(CARD_MATCH_DEFAULTS, CARD_MATCH_DEFAULTS, CARD_MATCH_FIELDS)).toEqual(
      CARD_MATCH_DEFAULTS,
    )
  })

  it('dealCards gives each chosen symbol exactly twice', () => {
    const cards = dealCards(createRng(2), 8)
    expect(cards).toHaveLength(16)
    const counts = new Map<number, number>()
    for (const c of cards) counts.set(c, (counts.get(c) ?? 0) + 1)
    expect([...counts.values()].every((n) => n === 2)).toBe(true)
    expect(cards.every((c) => c >= 0 && c < 18)).toBe(true)
    expect(new Set(dealCards(createRng(2), 18)).size).toBe(18)
  })

  const four = [0, 1, 0, 1] // partners 0↔2, 1↔3

  it('a match is one move, no mistake', () => {
    const r = play(createBoard(four, false), [0, 2])
    expect(r.events).toEqual(['first', 'match'])
    expect(r.board.moves).toBe(1)
    expect(r.board.memoryMistakes).toBe(0)
  })

  it('lucky first sight is not a mistake', () => {
    const r = play(createBoard(four, false), [0, 1])
    expect(r.events).toEqual(['first', 'mismatch'])
    expect(r.mistakes).toEqual([false, false])
  })

  it('skipping a known partner is a mistake', () => {
    const r = play(createBoard(four, false), [0, 1, 3, 0])
    expect(r.events.at(-1)).toBe('mismatch')
    expect(r.mistakes).toEqual([false, false, false, true])
    expect(r.board.memoryMistakes).toBe(1)
  })

  it('flipping a known non-partner is a mistake (partner unknown)', () => {
    const six = [0, 1, 2, 0, 1, 2] // partners 0↔3, 1↔4, 2↔5
    const r = play(createBoard(six, false), [1, 2, 0, 1])
    expect(r.mistakes).toEqual([false, false, false, true])
  })

  it('the preview counts as seen', () => {
    const r = play(createBoard(four, true), [0, 1])
    expect(r.mistakes.at(-1)).toBe(true)
  })

  it('a click during the flip-back clears the pair, then counts as a first flip', () => {
    const afterMismatch = play(createBoard(four, false), [0, 1]).board
    expect(afterMismatch.pending).toEqual([0, 1])
    const r = flip(afterMismatch, 2)
    expect(r.event).toBe('first')
    expect(r.board.pending).toBeNull()
    expect([0, 1, 2, 3].filter((i) => faceUp(r.board, i))).toEqual([2])
  })

  it('matched cards and the same card twice are ignored', () => {
    const matched = play(createBoard(four, false), [0, 2]).board
    expect(flip(matched, 0).event).toBe('ignored')
    expect(flip(matched, 0).board.moves).toBe(1)
    const first = flip(matched, 1).board
    expect(flip(first, 1).event).toBe('ignored')
  })

  it('isComplete after all pairs', () => {
    expect(isComplete(play(createBoard(four, false), [0, 2, 1, 3]).board)).toBe(true)
    expect(isComplete(play(createBoard(four, false), [0, 2]).board)).toBe(false)
  })

  it('summary', () => {
    const mk = (rows: number, cols: number, success: boolean, extra: number): RoundRecord => ({
      id: `${rows}${cols}`,
      gameId: 'card-match',
      at: 0,
      sessionId: null,
      success,
      level: 1,
      accuracy: 0.8,
      durationMs: 1,
      metrics: {
        rows,
        cols,
        pairs: (rows * cols) / 2,
        moves: 0,
        extraMoves: extra,
        memoryMistakes: success ? 0 : 2,
        preview: 1,
      },
    })
    const s = summarizeCardMatch([mk(2, 3, true, 0), mk(4, 4, true, 3), mk(4, 5, false, 6)])
    expect(s.headline).toBe('largest 4×4')
    expect(s.stats).toEqual([
      { label: 'Rounds', value: '3' },
      { label: 'Largest cleared', value: '4×4' },
      { label: 'Extra moves (avg, last 10)', value: '3.0' },
      { label: 'Perfect rounds (last 20)', value: '67%' },
    ])
    expect(summarizeCardMatch([]).headline).toBe('not played')
    expect(summarizeCardMatch([mk(2, 3, false, 1)]).headline).toBe('no perfect round yet')
  })
})
