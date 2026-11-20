import type { GameModule } from '@/games/types'
import {
  NAMES_FACES_DEFAULTS,
  NAMES_FACES_FIELDS,
  NAMES_FACES_ID,
  summarizeNamesFaces,
  type NamesFacesSettings,
} from './logic'

export const namesFaces: GameModule<NamesFacesSettings> = {
  id: NAMES_FACES_ID,
  name: 'Names & Faces',
  tagline: 'Meet a group of people, then name every face.',
  trains: 'Linking names to faces — a memorable feature + an image for the name',
  defaultSettings: NAMES_FACES_DEFAULTS,
  settingsFields: NAMES_FACES_FIELDS,
  component: () => import('./NamesFacesGame.vue'),
  summarize: summarizeNamesFaces,
}
