import type { GameModule } from '@/games/types'
import {
  KIMS_GAME_DEFAULTS,
  KIMS_GAME_FIELDS,
  KIMS_GAME_ID,
  summarizeKimsGame,
  type KimsGameSettings,
} from './logic'

export const kimsGame: GameModule<KimsGameSettings> = {
  id: KIMS_GAME_ID,
  name: "Kim's Game",
  tagline: 'A tray of objects appears, then hides — name them all, or spot what went missing.',
  trains: 'Rapid visual encoding of many objects and their places',
  defaultSettings: KIMS_GAME_DEFAULTS,
  settingsFields: KIMS_GAME_FIELDS,
  component: () => import('./KimsGame.vue'),
  summarize: summarizeKimsGame,
}
