import { cardMatch } from './card-match'
import { deckMemory } from './deck-memory'
import { longNumber } from './long-number'
import { maze } from './maze'
import { memoryGrid } from './memory-grid'
import { nBack } from './n-back'
import { numberFlash } from './number-flash'
import { quickMath } from './quick-math'
import { plates } from './plates'
import type { GameModule } from './types'

/**
 * Every minigame, in menu order. Adding a game = add its module here
 * (see .claude/skills/add-minigame).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each module has its own settings type
export const games: GameModule<any>[] = [
  longNumber,
  numberFlash,
  plates,
  maze,
  cardMatch,
  deckMemory,
  nBack,
  memoryGrid,
  quickMath,
]

export function getGame(id: string): GameModule | undefined {
  return games.find((g) => g.id === id)
}
