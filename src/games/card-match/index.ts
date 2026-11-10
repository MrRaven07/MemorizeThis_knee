import type { GameModule } from '@/games/types'
import {
  CARD_MATCH_DEFAULTS,
  CARD_MATCH_FIELDS,
  CARD_MATCH_ID,
  summarizeCardMatch,
  type CardMatchSettings,
} from './logic'

export const cardMatch: GameModule<CardMatchSettings> = {
  id: CARD_MATCH_ID,
  name: 'Card Match',
  tagline: 'Find every pair in as few moves as possible.',
  trains: 'Spatial location memory',
  defaultSettings: CARD_MATCH_DEFAULTS,
  settingsFields: CARD_MATCH_FIELDS,
  component: () => import('./CardMatchGame.vue'),
  summarize: summarizeCardMatch,
}
