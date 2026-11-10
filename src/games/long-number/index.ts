import type { GameModule } from '@/games/types'
import {
  LONG_NUMBER_DEFAULTS,
  LONG_NUMBER_FIELDS,
  summarizeLongNumber,
  type LongNumberSettings,
} from './logic'

export const longNumber: GameModule<LongNumberSettings> = {
  id: 'long-number',
  name: 'Long Number',
  tagline: 'Memorize one long number, then type it back.',
  trains: 'Chunking and memory-palace placement of long digit strings',
  defaultSettings: LONG_NUMBER_DEFAULTS,
  settingsFields: LONG_NUMBER_FIELDS,
  component: () => import('./LongNumberGame.vue'),
  summarize: summarizeLongNumber,
}
