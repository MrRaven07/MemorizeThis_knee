import type { GameModule } from '@/games/types'
import {
  DECK_MEMORY_DEFAULTS,
  DECK_MEMORY_FIELDS,
  DECK_MEMORY_ID,
  summarizeDeckMemory,
  type DeckMemorySettings,
} from './logic'

export const deckMemory: GameModule<DeckMemorySettings> = {
  id: DECK_MEMORY_ID,
  name: 'Deck Memory',
  tagline: 'Memorize the order of shuffled playing cards, then rebuild it.',
  trains: 'Memorizing card sequences — the memory-sport classic (PAO + memory palace)',
  defaultSettings: DECK_MEMORY_DEFAULTS,
  settingsFields: DECK_MEMORY_FIELDS,
  component: () => import('./DeckMemoryGame.vue'),
  summarize: summarizeDeckMemory,
}
