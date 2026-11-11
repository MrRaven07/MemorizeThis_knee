import type { StaircaseConfig } from '@/core/difficulty/staircase'
import { formatDuration } from '@/core/format'
import type { Rng } from '@/core/random/rng'
import { alignSequences, type SeqResult } from '@/core/scoring/align'
import type { GameSettings, GameSummary, RoundRecord, SettingField } from '@/games/types'
import { CARD_COUNT } from './cards'

/**
 * Deck Memory: memorize the order of shuffled playing cards, then rebuild it —
 * the memory-sport "Speed Cards" discipline (PAO images along a memory palace).
 * Added at the owner's request (question 012).
 */
export const DECK_MEMORY_ID = 'deck-memory'

export interface DeckMemorySettings extends GameSettings {
  /** correct rounds in a row to level up (question 007) */
  upAfter: number
  secondsPerCard: number
  view: 'one' | 'row'
}

export const DECK_MEMORY_DEFAULTS: DeckMemorySettings = {
  secondsPerCard: 5,
  view: 'one',
  upAfter: 3,
}

export const DECK_MEMORY_FIELDS: SettingField[] = [
  {
    key: 'secondsPerCard',
    label: 'Memorize time per card',
    type: 'number',
    min: 1,
    max: 20,
    step: 0.5,
    unit: 's',
  },
  {
    key: 'view',
    label: 'Show the cards',
    type: 'select',
    options: [
      { value: 'one', label: 'One at a time (flip through)' },
      { value: 'row', label: 'All at once, in a row' },
    ],
  },
  { key: 'upAfter', label: 'Correct in a row to level up', type: 'number', min: 3, max: 5 },
]

/** Cards per round for levels 1–10. */
export const DECK_LEVELS: readonly number[] = [4, 6, 8, 10, 13, 16, 20, 26, 39, 52]

export const DECK_STAIRCASE: StaircaseConfig = {
  start: 1,
  min: 1,
  max: DECK_LEVELS.length,
  upAfter: 3,
  upStep: 1,
  downAfter: 1,
  downStep: 1,
}

/** The staircase for one round, using that round's settings snapshot. */
export function deckStaircase(s: DeckMemorySettings): StaircaseConfig {
  return { ...DECK_STAIRCASE, upAfter: s.upAfter }
}

export function deckLevelCards(level: number): number {
  const i = Math.min(DECK_LEVELS.length, Math.max(1, Math.round(level))) - 1
  return DECK_LEVELS[i]!
}

export function dealSequence(rng: Rng, n: number): number[] {
  return rng.shuffle(Array.from({ length: CARD_COUNT }, (_, i) => i)).slice(0, n)
}

export function scoreDeck(expected: number[], answer: number[]): SeqResult<number> {
  return alignSequences(expected, answer)
}

export function summarizeDeckMemory(rounds: RoundRecord[]): GameSummary {
  if (rounds.length === 0) return { headline: 'not played', stats: [] }
  const wins = rounds.filter((r) => r.success)
  const largest = wins.length > 0 ? Math.max(...wins.map((r) => r.metrics.cards ?? 0)) : null
  const fastest =
    largest === null
      ? null
      : Math.min(
          ...wins
            .filter((r) => r.metrics.cards === largest)
            .map((r) => r.metrics.memoMs ?? Infinity),
        )
  const recent = rounds.slice(-20)
  const pct = Math.round((recent.filter((r) => r.success).length / recent.length) * 100)
  return {
    headline: largest === null ? 'no perfect round yet' : `best ${largest} cards`,
    stats: [
      { label: 'Rounds', value: String(rounds.length) },
      { label: 'Largest perfect', value: largest === null ? '—' : `${largest} cards` },
      {
        label: `Fastest memorization${largest === null ? '' : ` (${largest} cards)`}`,
        value: fastest === null || !Number.isFinite(fastest) ? '—' : formatDuration(fastest),
      },
      { label: 'Success (last 20)', value: `${pct}%` },
    ],
  }
}
