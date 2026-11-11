import { describe, expect, it } from 'vitest'
import { sanitizeSettings } from '@/games/settings'
import { CARD_MATCH_DEFAULTS, CARD_MATCH_FIELDS, cardStaircase } from './card-match/logic'
import { DECK_MEMORY_DEFAULTS, DECK_MEMORY_FIELDS, deckStaircase } from './deck-memory/logic'
import { MAZE_DEFAULTS, MAZE_FIELDS, mazeStaircase } from './maze/logic'
import { PLATES_DEFAULTS, PLATES_FIELDS, platesStaircase } from './plates/logic'
import type { GameSettings, SettingField } from './types'

const games: [
  string,
  GameSettings & { upAfter: number },
  SettingField[],
  (s: never) => { upAfter: number },
][] = [
  ['plates', PLATES_DEFAULTS, PLATES_FIELDS, platesStaircase as never],
  ['maze', MAZE_DEFAULTS, MAZE_FIELDS, mazeStaircase as never],
  ['card-match', CARD_MATCH_DEFAULTS, CARD_MATCH_FIELDS, cardStaircase as never],
  ['deck-memory', DECK_MEMORY_DEFAULTS, DECK_MEMORY_FIELDS, deckStaircase as never],
]

describe.each(games)('%s level-up setting (Q007)', (_name, defaults, fields, staircase) => {
  it('defaults to 3 and old saved settings sanitize to 3', () => {
    expect(defaults.upAfter).toBe(3)
    expect(sanitizeSettings({}, defaults, fields).upAfter).toBe(3)
    expect(sanitizeSettings({ upAfter: 9 }, defaults, fields).upAfter).toBe(5)
  })
  it('the staircase follows the setting', () => {
    expect(staircase({ ...defaults, upAfter: 5 } as never).upAfter).toBe(5)
  })
})
