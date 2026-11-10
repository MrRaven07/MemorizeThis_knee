import type { GameModule } from '@/games/types'
import {
  NUMBER_FLASH_DEFAULTS,
  NUMBER_FLASH_FIELDS,
  NUMBER_FLASH_ID,
  summarizeNumberFlash,
  type NumberFlashSettings,
} from './logic'

export const numberFlash: GameModule<NumberFlashSettings> = {
  id: NUMBER_FLASH_ID,
  name: 'Number Flash',
  tagline: 'A short number flashes. Type it back — it grows as you improve.',
  trains: 'Fast encoding of short digit sequences (digit span)',
  defaultSettings: NUMBER_FLASH_DEFAULTS,
  settingsFields: NUMBER_FLASH_FIELDS,
  component: () => import('./NumberFlashGame.vue'),
  summarize: summarizeNumberFlash,
}
