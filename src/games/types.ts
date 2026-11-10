import type { AsyncComponentLoader } from 'vue'

/**
 * The contract every minigame implements. A game is a folder in src/games/<id>/
 * whose index.ts exports a GameModule, listed in src/games/registry.ts.
 *
 * The game's Vue component receives `settings` (a snapshot for the round) and
 * emits `round-complete` with a RoundResult when a round ends. It never
 * touches storage directly — GameView records the result.
 */
export type SettingValue = number | boolean | string
export type GameSettings = Record<string, SettingValue>

export type SettingField = { key: string; label: string; help?: string } & (
  | { type: 'number'; min: number; max: number; step?: number; unit?: string }
  | { type: 'boolean' }
  | { type: 'select'; options: { value: string; label: string }[] }
)

export interface RoundResult {
  success: boolean
  /** difficulty level played, for adaptive games; null otherwise */
  level: number | null
  /** 0..1, or null if the game has no accuracy notion */
  accuracy: number | null
  durationMs: number
  /** game-specific numbers, e.g. { length: 24, correct: 22 } */
  metrics: Record<string, number>
}

export interface RoundRecord extends RoundResult {
  id: string
  gameId: string
  /** epoch ms */
  at: number
  sessionId: string | null
}

export interface GameSummary {
  /** short line for the home tile, e.g. "best 24" */
  headline: string
  stats: { label: string; value: string }[]
}

export interface GameModule<S extends GameSettings = GameSettings> {
  id: string
  name: string
  tagline: string
  /** which memory skill it trains (shown in the menu) */
  trains: string
  defaultSettings: S
  settingsFields: SettingField[]
  component: AsyncComponentLoader
  summarize(rounds: RoundRecord[]): GameSummary
}

/**
 * Props every game component receives. Games must copy `settings` when a round
 * starts (changes apply from the next round).
 *
 * Events a game component emits:
 *   - 'round-complete' (result: RoundResult) — required, once per finished round
 *   - 'level' (level: number | null)        — optional, shown in the GameShell header
 */
export interface GameComponentProps<S extends GameSettings = GameSettings> {
  settings: S
}
