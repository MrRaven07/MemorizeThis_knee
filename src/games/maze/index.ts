import type { GameModule } from '@/games/types'
import { MAZE_DEFAULTS, MAZE_FIELDS, MAZE_ID, summarizeMaze, type MazeSettings } from './logic'

export const maze: GameModule<MazeSettings> = {
  id: MAZE_ID,
  name: 'Maze',
  tagline: 'See the maze, then type the way out — mind the spikes.',
  trains: 'Spatial memory and route encoding (a walk through a memory palace)',
  defaultSettings: MAZE_DEFAULTS,
  settingsFields: MAZE_FIELDS,
  component: () => import('./MazeGame.vue'),
  summarize: summarizeMaze,
}
