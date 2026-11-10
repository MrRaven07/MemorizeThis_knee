import { longNumber } from './long-number'
import { numberFlash } from './number-flash'
import type { GameModule } from './types'

/**
 * Every minigame, in menu order. Adding a game = add its module here
 * (see .claude/skills/add-minigame).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each module has its own settings type
export const games: GameModule<any>[] = [longNumber, numberFlash]

export function getGame(id: string): GameModule | undefined {
  return games.find((g) => g.id === id)
}
