import type { GameModule } from '@/games/types'
import {
  N_BACK_DEFAULTS,
  N_BACK_FIELDS,
  N_BACK_ID,
  summarizeNBack,
  type NBackSettings,
} from './logic'

export const nBack: GameModule<NBackSettings> = {
  id: N_BACK_ID,
  name: 'N-Back',
  tagline: 'Press when the item matches the one N steps back.',
  trains: 'Working memory — holding and updating the last N items',
  defaultSettings: N_BACK_DEFAULTS,
  settingsFields: N_BACK_FIELDS,
  component: () => import('./NBackGame.vue'),
  summarize: summarizeNBack,
}
