import type { Rng } from '@/core/random/rng'
import type { GameSettings, GameSummary, RoundRecord, SettingField } from '@/games/types'

/**
 * Sequence: pads light up (and sound) in a sequence that grows by one pad per
 * step; the player repeats it each time, until the first mistake. Built for
 * very long runs (hundreds of steps). Rules in questions/018.
 *
 * A **run** is one growing sequence and produces one RoundResult. A **step**
 * is one playback + one repeat; step 1 shows the start length in full.
 */
export const SEQUENCE_ID = 'sequence'

export type Feedback = 'both' | 'colors' | 'tones'

export interface SequenceSettings extends GameSettings {
  /** '4' | '6' | '9' — a select, so the value is a string */
  pads: string
  feedback: Feedback
  startLength: number
  baseMs: number
  /** seconds; 0 = off, otherwise at least 2 */
  inputTimeout: number
  volume: number
}

export const SEQUENCE_DEFAULTS: SequenceSettings = {
  pads: '4',
  feedback: 'both',
  startLength: 1,
  baseMs: 700,
  inputTimeout: 0,
  volume: 60,
}

export const SEQUENCE_FIELDS: SettingField[] = [
  {
    key: 'pads',
    label: 'Pads',
    type: 'select',
    options: [
      { value: '4', label: '4 pads (2×2)' },
      { value: '6', label: '6 pads (2×3)' },
      { value: '9', label: '9 pads (3×3)' },
    ],
  },
  {
    key: 'feedback',
    label: 'Playback',
    type: 'select',
    options: [
      { value: 'both', label: 'Colours and tones' },
      { value: 'colors', label: 'Colours only (silent)' },
      { value: 'tones', label: 'Tones only (pads stay dark)' },
    ],
  },
  { key: 'startLength', label: 'Start length', type: 'number', min: 1, max: 50 },
  {
    key: 'baseMs',
    label: 'Time per item at the start',
    help: 'Gets 15 ms faster every step, down to 250 ms.',
    type: 'number',
    min: 400,
    max: 1200,
    step: 50,
    unit: 'ms',
  },
  {
    key: 'inputTimeout',
    label: 'Max pause between taps',
    help: '0 = no limit. Otherwise at least 2 s; a longer pause ends the run.',
    type: 'number',
    min: 0,
    max: 10,
    unit: 's',
  },
  { key: 'volume', label: 'Volume', type: 'number', min: 0, max: 100, step: 5, unit: '%' },
]

export const PAD_COUNTS = [4, 6, 9] as const
/** Safety limit on the sequence length (questions/018). */
export const MAX_LENGTH = 999
export const MIN_ITEM_MS = 250
export const ITEM_MS_STEP = 15
export const GAP_RATIO = 0.3
/** Dark pause before the first item of every playback. */
export const LEAD_MS = 600
export const MIN_TIMEOUT_S = 2

export function padCount(pads: string): number {
  const n = Number(pads)
  return (PAD_COUNTS as readonly number[]).includes(n) ? n : 4
}

/** Input timeout in ms: 0 = off; 1 s is raised to the 2 s minimum. */
export function timeoutMs(seconds: number): number {
  return seconds <= 0 ? 0 : Math.max(MIN_TIMEOUT_S, seconds) * 1000
}

export interface Sequence {
  readonly length: number
  /** The pad (0-based) at position i. */
  at(i: number): number
  /** Appends one random pad; false at the safety cap. */
  grow(): boolean
  growTo(n: number): void
}

/**
 * A lazily grown, append-only sequence: one RNG draw per new item, earlier
 * items never change. Same seed → same sequence, whatever the length.
 */
export function createSequence(rng: Rng, pads: number): Sequence {
  const items: number[] = []
  const grow = () => {
    if (items.length >= MAX_LENGTH) return false
    items.push(rng.int(0, pads - 1))
    return true
  }
  return {
    get length() {
      return items.length
    },
    at: (i) => items[i] ?? -1,
    grow,
    growTo(n) {
      while (items.length < n && grow());
    },
  }
}

/** How long each item is shown at this step (1-based). */
export function itemMs(baseMs: number, step: number): number {
  return Math.max(MIN_ITEM_MS, baseMs - ITEM_MS_STEP * (step - 1))
}

export function gapMs(item: number): number {
  return Math.round(item * GAP_RATIO)
}

/** Total playback time for a sequence of n items. */
export function playbackMs(n: number, item: number): number {
  return LEAD_MS + n * (item + gapMs(item))
}

/**
 * Which item is showing `elapsed` ms into a playback. Pure arithmetic on one
 * clock (as in N-Back), so item 300 is exactly as long as item 1: no drift.
 */
export function playbackAt(
  elapsed: number,
  n: number,
  item: number,
): { index: number; lit: boolean } {
  if (elapsed < LEAD_MS || n <= 0) return { index: -1, lit: false }
  const slot = item + gapMs(item)
  const t = elapsed - LEAD_MS
  const raw = Math.floor(t / slot)
  const index = Math.min(n - 1, raw)
  return { index, lit: raw < n && t - raw * slot < item }
}

export type TapOutcome = 'correct' | 'complete' | 'wrong'

export function checkTap(seq: Sequence, position: number, pad: number): TapOutcome {
  if (seq.at(position) !== pad) return 'wrong'
  return position === seq.length - 1 ? 'complete' : 'correct'
}

const QWAS = ['q', 'w', 'a', 's']

/** Keys 1–9 (also numpad with NumLock off), and Q W A S for 4 pads. */
export function keyToPad(e: { key: string; code: string }, pads: number): number | null {
  let pad: number | null = null
  const numpad = /^Numpad([1-9])$/.exec(e.code)
  if (/^[1-9]$/.test(e.key)) pad = Number(e.key) - 1
  else if (numpad) pad = Number(numpad[1]) - 1
  else if (pads === 4 && QWAS.includes(e.key.toLowerCase())) pad = QWAS.indexOf(e.key.toLowerCase())
  return pad !== null && pad < pads ? pad : null
}

/** Longest `reached` for this pad count, or null if never played with it. */
export function bestFor(rounds: RoundRecord[], pads: number): number | null {
  let best: number | null = null
  for (const r of rounds) {
    if (r.metrics.pads !== pads) continue
    const reached = r.metrics.reached ?? 0
    if (best === null || reached > best) best = reached
  }
  return best
}

export function startFromBest(best: number): number {
  return Math.max(1, best - 3)
}

/** A run succeeds when it ties or beats the previous best (first run counts). */
export function isSuccess(reached: number, previousBest: number | null): boolean {
  return previousBest === null || reached >= previousBest
}

export interface RunMetrics {
  reached: number
  startLength: number
  pads: number
  steps: number
  [key: string]: number
}

export function runMetrics(m: RunMetrics): RunMetrics {
  return { reached: m.reached, startLength: m.startLength, pads: m.pads, steps: m.steps }
}

/** Items repeated correctly over completed steps: lengths L, L+1, … per run. */
export function totalRecalled(rounds: RoundRecord[]): number {
  return rounds.reduce((sum, r) => {
    const steps = r.metrics.steps ?? 0
    const start = r.metrics.startLength ?? 1
    return sum + steps * start + (steps * (steps - 1)) / 2
  }, 0)
}

export function summarizeSequence(rounds: RoundRecord[]): GameSummary {
  if (rounds.length === 0) return { headline: 'not played', stats: [] }
  const best = Math.max(...rounds.map((r) => r.metrics.reached ?? 0))
  const last10 = rounds.slice(-10)
  const avg = last10.reduce((a, r) => a + (r.metrics.reached ?? 0), 0) / last10.length
  return {
    headline: `best ${best}`,
    stats: [
      { label: 'Runs', value: String(rounds.length) },
      ...PAD_COUNTS.map((p) => {
        const b = bestFor(rounds, p)
        return { label: `Best (${p} pads)`, value: b === null ? '—' : String(b) }
      }),
      { label: 'Average (last 10)', value: avg.toFixed(1) },
      { label: 'Total items recalled', value: String(totalRecalled(rounds)) },
    ],
  }
}
