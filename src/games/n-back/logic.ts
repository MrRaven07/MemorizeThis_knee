import {
  stepThreeZone,
  type StaircaseConfig,
  type StaircaseState,
} from '@/core/difficulty/staircase'
import type { Rng } from '@/core/random/rng'
import type { GameSettings, GameSummary, RoundRecord, SettingField } from '@/games/types'

/**
 * N-Back: a stream of stimuli; press "match" when the current one equals the
 * one N steps back. Trains working memory (holding and updating the last N
 * items). Added at the owner's request; rules in question 014.
 */
export const N_BACK_ID = 'n-back'

export type NBackMode = 'position' | 'digit' | 'dual'
export const MODES: readonly NBackMode[] = ['position', 'digit', 'dual']

export interface NBackSettings extends GameSettings {
  mode: NBackMode
  trialMs: number
  feedback: boolean
  upAfter: number
}

export const N_BACK_DEFAULTS: NBackSettings = {
  mode: 'position',
  trialMs: 2500,
  feedback: true,
  upAfter: 3,
}

export const N_BACK_FIELDS: SettingField[] = [
  {
    key: 'mode',
    label: 'What to remember',
    type: 'select',
    options: [
      { value: 'position', label: 'Positions on a grid' },
      { value: 'digit', label: 'Digits' },
      { value: 'dual', label: 'Both at once (dual)' },
    ],
  },
  {
    key: 'trialMs',
    label: 'Time per item',
    type: 'number',
    min: 1500,
    max: 4000,
    step: 250,
    unit: 'ms',
  },
  { key: 'feedback', label: 'Show ✓ / ✗ after each press', type: 'boolean' },
  { key: 'upAfter', label: 'Passed rounds in a row to level up', type: 'number', min: 3, max: 5 },
]

/** How long the stimulus is visible at the start of each trial. */
export const STIMULUS_MS = 500
export const TARGETS_PER_STREAM = 6
/** Accuracy thresholds (question 014): pass ≥ 0.8 · drop < 0.5 · otherwise stay. */
export const PASS_ACCURACY = 0.8
export const DROP_ACCURACY = 0.5

export const POSITIONS = 9
export const DIGITS = 10

export const trialsFor = (n: number) => 20 + n

/** Each mode keeps its own level, so dual can't drag down single-mode N. */
export const levelKey = (mode: NBackMode) => `${N_BACK_ID}:${mode}`

export const modeCode = (mode: NBackMode) => MODES.indexOf(mode)

export function nBackStaircase(s: NBackSettings): StaircaseConfig {
  return { start: 2, min: 1, max: 9, upAfter: s.upAfter, upStep: 1, downAfter: 1, downStep: 1 }
}

/**
 * A stream of `size` items from 0..alphabet-1 with exactly TARGETS_PER_STREAM
 * targets (item i equals item i−n) placed at random among i ≥ n. Non-targets
 * never accidentally match the item n back.
 */
export function generateStream(rng: Rng, n: number, size: number, alphabet: number): number[] {
  const scorable = Array.from({ length: size - n }, (_, i) => i + n)
  const targets = new Set(rng.shuffle(scorable).slice(0, TARGETS_PER_STREAM))
  const s: number[] = []
  for (let i = 0; i < size; i++) {
    if (i < n) s.push(rng.int(0, alphabet - 1))
    else if (targets.has(i)) s.push(s[i - n]!)
    else {
      const avoid = s[i - n]!
      const v = rng.int(0, alphabet - 2) // pick among the other alphabet − 1 values
      s.push(v >= avoid ? v + 1 : v)
    }
  }
  return s
}

export interface StreamScore {
  hits: number
  misses: number
  falseAlarms: number
  correctRejections: number
}

export function isTarget(stream: number[], n: number, i: number): boolean {
  return i >= n && stream[i] === stream[i - n]
}

export function scoreStream(stream: number[], n: number, presses: boolean[]): StreamScore {
  const c: StreamScore = { hits: 0, misses: 0, falseAlarms: 0, correctRejections: 0 }
  for (let i = n; i < stream.length; i++) {
    const target = isTarget(stream, n, i)
    const pressed = presses[i] === true
    if (target && pressed) c.hits++
    else if (target) c.misses++
    else if (pressed) c.falseAlarms++
    else c.correctRejections++
  }
  return c
}

/** hits / (hits + misses + false alarms), summed over streams — never pressing scores 0. */
export function nBackAccuracy(scores: StreamScore[]): number {
  const hits = scores.reduce((a, s) => a + s.hits, 0)
  const denom = scores.reduce((a, s) => a + s.hits + s.misses + s.falseAlarms, 0)
  return denom === 0 ? 0 : hits / denom
}

/** Three zones: pass counts toward going up, low accuracy drops N, otherwise stay. */
export function nextNBackState(
  state: StaircaseState,
  cfg: StaircaseConfig,
  accuracy: number,
): StaircaseState {
  const outcome = accuracy >= PASS_ACCURACY ? 'pass' : accuracy < DROP_ACCURACY ? 'drop' : 'stay'
  return stepThreeZone(state, cfg, outcome)
}

export function summarizeNBack(rounds: RoundRecord[]): GameSummary {
  if (rounds.length === 0) return { headline: 'not played', stats: [] }
  const passed = rounds.filter((r) => r.success)
  const best = passed.reduce<RoundRecord | null>(
    (b, r) => (!b || (r.level ?? 0) > (b.level ?? 0) ? r : b),
    null,
  )
  const modeName = (r: RoundRecord) => MODES[r.metrics.mode ?? 0] ?? 'position'
  const perMode = MODES.flatMap((mode, code) => {
    const played = rounds.filter((r) => (r.metrics.mode ?? 0) === code)
    if (played.length === 0) return []
    const wins = played.filter((r) => r.success).map((r) => r.level ?? 0)
    return [
      { label: `Highest N (${mode})`, value: wins.length > 0 ? String(Math.max(...wins)) : '—' },
    ]
  })
  const last10 = rounds.slice(-10)
  const acc = last10.reduce((a, r) => a + (r.accuracy ?? 0), 0) / last10.length
  const last20 = rounds.slice(-20)
  const pct = Math.round((last20.filter((r) => r.success).length / last20.length) * 100)
  return {
    headline: best ? `best N=${best.level} (${modeName(best)})` : 'no round passed yet',
    stats: [
      { label: 'Rounds', value: String(rounds.length) },
      ...perMode,
      { label: 'Accuracy (last 10)', value: `${Math.round(acc * 100)}%` },
      { label: 'Success (last 20)', value: `${pct}%` },
    ],
  }
}
