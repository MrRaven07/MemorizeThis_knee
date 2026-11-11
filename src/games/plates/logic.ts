import type { StaircaseConfig } from '@/core/difficulty/staircase'
import type { Rng } from '@/core/random/rng'
import { alignStrings, type AlignResult } from '@/core/scoring/align'
import type { GameSettings, GameSummary, RoundRecord, SettingField } from '@/games/types'
import { plateFormats, type Plate, type PlateFormat } from './formats'

/**
 * License Plates: several realistic plates are shown together at different
 * sizes, then retyped. Spec §6.3, questions 006/007.
 */
export const PLATES_ID = 'plates'

export interface PlatesSettings extends GameSettings {
  /** correct rounds in a row to level up (question 007) */
  upAfter: number
  country: string
  timeMultiplier: number
}

export const PLATES_DEFAULTS: PlatesSettings = { country: 'ro', timeMultiplier: 1, upAfter: 3 }

export const PLATES_FIELDS: SettingField[] = [
  {
    key: 'country',
    label: 'Country',
    type: 'select',
    options: plateFormats.map((f) => ({ value: f.id, label: f.name })),
  },
  {
    key: 'timeMultiplier',
    label: 'Viewing time',
    type: 'number',
    min: 0.5,
    max: 2,
    step: 0.25,
    unit: '×',
    help: 'below 1 is harder, above 1 is easier',
  },
  { key: 'upAfter', label: 'Correct in a row to level up', type: 'number', min: 3, max: 5 },
]

export interface PlateLevel {
  plates: number
  viewSeconds: number
  minScale: number
  maxScale: number
}

/** The difficulty curve (question 007). Index 0 = level 1. */
export const PLATE_LEVELS: readonly PlateLevel[] = [
  { plates: 1, viewSeconds: 6, minScale: 1, maxScale: 1 },
  { plates: 1, viewSeconds: 4, minScale: 1, maxScale: 1 },
  { plates: 2, viewSeconds: 8, minScale: 1, maxScale: 1 },
  { plates: 2, viewSeconds: 6, minScale: 0.75, maxScale: 1.25 },
  { plates: 3, viewSeconds: 9, minScale: 0.75, maxScale: 1.25 },
  { plates: 3, viewSeconds: 7, minScale: 0.75, maxScale: 1.25 },
  { plates: 4, viewSeconds: 10, minScale: 0.6, maxScale: 1.4 },
  { plates: 4, viewSeconds: 8, minScale: 0.6, maxScale: 1.4 },
  { plates: 5, viewSeconds: 10, minScale: 0.5, maxScale: 1.5 },
  { plates: 5, viewSeconds: 8, minScale: 0.5, maxScale: 1.5 },
  { plates: 6, viewSeconds: 10, minScale: 0.5, maxScale: 1.5 },
  { plates: 6, viewSeconds: 8, minScale: 0.5, maxScale: 1.5 },
]

export const PLATES_STAIRCASE: StaircaseConfig = {
  start: 1,
  min: 1,
  max: PLATE_LEVELS.length,
  upAfter: 3,
  upStep: 1,
  downAfter: 1,
  downStep: 1,
}

/** The staircase for one round, using that round's settings snapshot. */
export function platesStaircase(s: PlatesSettings): StaircaseConfig {
  return { ...PLATES_STAIRCASE, upAfter: s.upAfter }
}

export function levelInfo(level: number): PlateLevel {
  const i = Math.min(PLATE_LEVELS.length, Math.max(1, Math.round(level))) - 1
  return PLATE_LEVELS[i]!
}

export function viewMs(level: number, multiplier: number): number {
  return Math.max(1000, Math.round(levelInfo(level).viewSeconds * 1000 * multiplier))
}

export interface PlateRound {
  plates: Plate[]
  scales: number[]
}

export function generateRound(rng: Rng, level: number, format: PlateFormat): PlateRound {
  const info = levelInfo(level)
  const plates: Plate[] = []
  while (plates.length < info.plates) {
    const p = format.generate(rng)
    const prev = plates.at(-1)
    if (plates.some((q) => q.text === p.text)) continue
    if (prev && prev.segments[0] === p.segments[0]) continue
    plates.push(p)
  }
  const scales = plates.map(() =>
    info.minScale === info.maxScale
      ? info.minScale
      : Math.round((info.minScale + rng.next() * (info.maxScale - info.minScale)) * 100) / 100,
  )
  return { plates, scales }
}

export function normalizePlateInput(input: string): string {
  return input
    .normalize('NFC')
    .toUpperCase()
    .replace(/[\s-]+/gu, '')
}

export interface PlatesScore {
  perPlate: AlignResult[]
  accuracy: number
  success: boolean
}

export function scorePlates(plates: Plate[], answers: string[]): PlatesScore {
  const perPlate = plates.map((p, i) =>
    alignStrings(p.segments.join(''), normalizePlateInput(answers[i] ?? '')),
  )
  const accuracy =
    perPlate.length === 0 ? 1 : perPlate.reduce((a, r) => a + r.accuracy, 0) / perPlate.length
  return { perPlate, accuracy, success: perPlate.every((r) => r.exact) }
}

export function summarizePlates(rounds: RoundRecord[]): GameSummary {
  if (rounds.length === 0) return { headline: 'not played', stats: [] }
  const wins = rounds.filter((r) => r.success)
  const bestLevel = wins.length > 0 ? Math.max(...wins.map((r) => r.level ?? 0)) : null
  const mostPlates = wins.length > 0 ? Math.max(...wins.map((r) => r.metrics.plates ?? 0)) : null
  const recent = rounds.slice(-20)
  const successPct = Math.round((recent.filter((r) => r.success).length / recent.length) * 100)
  return {
    headline: bestLevel === null ? 'no perfect round yet' : `best level ${bestLevel}`,
    stats: [
      { label: 'Rounds', value: String(rounds.length) },
      { label: 'Best level', value: bestLevel === null ? '—' : String(bestLevel) },
      { label: 'Most plates at once', value: mostPlates === null ? '—' : String(mostPlates) },
      { label: 'Success (last 20)', value: `${successPct}%` },
    ],
  }
}
