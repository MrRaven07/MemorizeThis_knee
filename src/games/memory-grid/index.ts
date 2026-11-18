import type { GameModule } from '@/games/types'
import {
  MEMORY_GRID_DEFAULTS,
  MEMORY_GRID_FIELDS,
  MEMORY_GRID_ID,
  summarizeMemoryGrid,
  type MemoryGridSettings,
} from './logic'

export const memoryGrid: GameModule<MemoryGridSettings> = {
  id: MEMORY_GRID_ID,
  name: 'Memory Grid',
  tagline: 'A pattern lights up — tap it back from memory.',
  trains: 'Visual-spatial memory of patterns',
  defaultSettings: MEMORY_GRID_DEFAULTS,
  settingsFields: MEMORY_GRID_FIELDS,
  component: () => import('./MemoryGridGame.vue'),
  summarize: summarizeMemoryGrid,
}
