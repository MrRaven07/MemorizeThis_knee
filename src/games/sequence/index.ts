import type { GameModule } from '@/games/types'
import {
  SEQUENCE_DEFAULTS,
  SEQUENCE_FIELDS,
  SEQUENCE_ID,
  summarizeSequence,
  type SequenceSettings,
} from './logic'

export const sequence: GameModule<SequenceSettings> = {
  id: SEQUENCE_ID,
  name: 'Sequence',
  tagline: 'Colours and tones in a sequence that grows by one each step.',
  trains: 'Sequence span — chunking and storing a growing sequence',
  defaultSettings: SEQUENCE_DEFAULTS,
  settingsFields: SEQUENCE_FIELDS,
  component: () => import('./SequenceGame.vue'),
  summarize: summarizeSequence,
}
