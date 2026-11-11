import { describe, expect, it } from 'vitest'
import { createRng } from '@/core/random/rng'
import { sanitizeSettings } from '@/games/settings'
import type { RoundRecord } from '@/games/types'
import { CARD_COUNT, cardCode, cardName, isRed, parseCode, parseCodes } from './cards'
import {
  DECK_LEVELS,
  DECK_MEMORY_DEFAULTS,
  DECK_MEMORY_FIELDS,
  DECK_MEMORY_ID,
  DECK_STAIRCASE,
  dealSequence,
  deckLevelCards,
  scoreDeck,
  summarizeDeckMemory,
} from './logic'

const id = (code: string) => parseCode(code)!

describe('cards', () => {
  it('all 52 codes round-trip and are unique', () => {
    const codes = Array.from({ length: CARD_COUNT }, (_, i) => cardCode(i))
    expect(new Set(codes).size).toBe(52)
    expect(codes.map((c) => parseCode(c))).toEqual(Array.from({ length: 52 }, (_, i) => i))
    expect(cardCode(0)).toBe('AS')
    expect(cardCode(51)).toBe('KC')
  })

  it('names and colours', () => {
    expect(cardName(id('QD'))).toBe('Queen of diamonds')
    expect(cardName(id('10H'))).toBe('Ten of hearts')
    expect(isRed(id('QD'))).toBe(true)
    expect(isRed(id('AS'))).toBe(false)
  })

  it('parses sloppy codes', () => {
    expect(parseCode('ts')).toBe(parseCode('10S'))
    expect(parseCode('10♥')).toBe(id('10H'))
    expect(parseCode('qd')).toBe(id('QD'))
    expect(parseCode('K♣')).toBe(id('KC'))
    expect(parseCode('Q\u2665\uFE0F')).toBe(id('QH'))
    expect(parseCode('1x')).toBeNull()
    expect(parseCode('')).toBeNull()
    expect(parseCode('11H')).toBeNull()
  })

  it('parseCodes reports invalid and already-used tokens', () => {
    const r = parseCodes('AS 2h zz AS', new Set([id('2H')]))
    expect(r.ids).toEqual([id('AS')])
    expect(r.problems).toEqual([
      { token: '2h', reason: 'used' },
      { token: 'zz', reason: 'invalid' },
      { token: 'AS', reason: 'used' },
    ])
    expect(parseCodes('  ', new Set())).toEqual({ ids: [], problems: [] })
    expect(parseCodes('as,kd;qc', new Set()).ids).toEqual([id('AS'), id('KD'), id('QC')])
  })
})

describe('deck memory logic', () => {
  it('ids, levels, staircase, defaults', () => {
    expect(DECK_MEMORY_ID).toBe('deck-memory')
    expect(DECK_LEVELS).toEqual([4, 6, 8, 10, 13, 16, 20, 26, 39, 52])
    expect(DECK_LEVELS.every((n, i) => i === 0 || n > DECK_LEVELS[i - 1]!)).toBe(true)
    expect(DECK_STAIRCASE).toEqual({
      start: 1,
      min: 1,
      max: 10,
      upAfter: 3,
      upStep: 1,
      downAfter: 1,
      downStep: 1,
    })
    expect(deckLevelCards(99)).toBe(52)
    expect(DECK_MEMORY_DEFAULTS).toEqual({ secondsPerCard: 5, view: 'one' })
    expect(
      sanitizeSettings(DECK_MEMORY_DEFAULTS, DECK_MEMORY_DEFAULTS, DECK_MEMORY_FIELDS),
    ).toEqual(DECK_MEMORY_DEFAULTS)
  })

  it('dealSequence gives distinct seeded cards', () => {
    const a = dealSequence(createRng(1), 13)
    expect(a).toHaveLength(13)
    expect(new Set(a).size).toBe(13)
    expect(dealSequence(createRng(1), 13)).toEqual(a)
    expect(new Set(dealSequence(createRng(2), 52)).size).toBe(52)
  })

  it('scoreDeck: one skipped card costs one card', () => {
    const r = scoreDeck([1, 2, 3, 4], [1, 3, 4])
    expect(r.correct).toBe(3)
    expect(r.exact).toBe(false)
    expect(scoreDeck([1, 2], [1, 2]).exact).toBe(true)
  })

  it('summary', () => {
    const mk = (cards: number, success: boolean, memoMs: number): RoundRecord => ({
      id: `${cards}${memoMs}`,
      gameId: 'deck-memory',
      at: 0,
      sessionId: null,
      success,
      level: 1,
      accuracy: success ? 1 : 0.5,
      durationMs: 1,
      metrics: { cards, correct: cards, memoMs },
    })
    const s = summarizeDeckMemory([
      mk(4, true, 9000),
      mk(8, true, 40_000),
      mk(8, true, 31_000),
      mk(10, false, 1000),
    ])
    expect(s.headline).toBe('best 8 cards')
    expect(s.stats).toEqual([
      { label: 'Rounds', value: '4' },
      { label: 'Largest perfect', value: '8 cards' },
      { label: 'Fastest memorization (8 cards)', value: '0:31' },
      { label: 'Success (last 20)', value: '75%' },
    ])
    expect(summarizeDeckMemory([]).headline).toBe('not played')
    expect(summarizeDeckMemory([mk(4, false, 1)]).headline).toBe('no perfect round yet')
  })
})
