import type { GameModule } from '@/games/types'
import {
  PLATES_DEFAULTS,
  PLATES_FIELDS,
  PLATES_ID,
  summarizePlates,
  type PlatesSettings,
} from './logic'

export const plates: GameModule<PlatesSettings> = {
  id: PLATES_ID,
  name: 'License Plates',
  tagline: 'Memorize the plates, then type them back.',
  trains: 'Encoding mixed letter/digit chunks at a glance',
  defaultSettings: PLATES_DEFAULTS,
  settingsFields: PLATES_FIELDS,
  component: () => import('./PlatesGame.vue'),
  summarize: summarizePlates,
}
