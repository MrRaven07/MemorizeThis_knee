import type { GameModule } from '@/games/types'
import {
  QUICK_MATH_DEFAULTS,
  QUICK_MATH_FIELDS,
  QUICK_MATH_ID,
  summarizeQuickMath,
  type QuickMathSettings,
} from './logic'

export const quickMath: GameModule<QuickMathSettings> = {
  id: QUICK_MATH_ID,
  name: 'Quick Math',
  tagline: 'Solve as many quick problems as you can before time runs out.',
  trains: 'Working memory under time pressure (a drill, not a memory technique)',
  defaultSettings: QUICK_MATH_DEFAULTS,
  settingsFields: QUICK_MATH_FIELDS,
  component: () => import('./QuickMathGame.vue'),
  summarize: summarizeQuickMath,
}
