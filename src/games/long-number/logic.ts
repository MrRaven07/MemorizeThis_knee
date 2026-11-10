import type { Rng } from '@/core/random/rng'
import { randomDigits } from '@/core/random/rng'
import { alignStrings, type AlignResult } from '@/core/scoring/align'
import type { GameSettings, GameSummary, RoundRecord, SettingField } from '@/games/types'

/**
 * Long Number: one long number (or several joined together) shown for a set
 * time, then typed back. Trains chunking and placing digit groups along a
 * memory-palace route.
 */
export interface LongNumberSettings extends GameSettings {
  groups: number
  digitsPerGroup: number
  separateGroups: boolean
  memorizeSeconds: number
  delaySeconds: number
  /** 0 = no limit */
  recallSeconds: number
}

export const LONG_NUMBER_DEFAULTS: LongNumberSettings = {
  groups: 1,
  digitsPerGroup: 10,
  separateGroups: true,
  memorizeSeconds: 15,
  delaySeconds: 5,
  recallSeconds: 0,
}

export const LONG_NUMBER_FIELDS: SettingField[] = [
  { key: 'groups', label: 'Numbers to join', type: 'number', min: 1, max: 20 },
  { key: 'digitsPerGroup', label: 'Digits per number', type: 'number', min: 1, max: 40 },
  { key: 'separateGroups', label: 'Show a gap between numbers', type: 'boolean' },
  { key: 'memorizeSeconds', label: 'Time to memorize', type: 'number', min: 1, max: 600, unit: 's' },
  { key: 'delaySeconds', label: 'Wait before recall', type: 'number', min: 0, max: 600, unit: 's' },
  {
    key: 'recallSeconds',
    label: 'Time to type',
    type: 'number',
    min: 0,
    max: 600,
    unit: 's',
    help: '0 = no limit',
  },
]

const THIN_SPACE = '\u2009'

export function generateGroups(rng: Rng, s: LongNumberSettings): string[] {
  return Array.from({ length: s.groups }, () => randomDigits(rng, s.digitsPerGroup))
}

export function formatGroups(groups: string[], separate: boolean): string {
  return groups.join(separate ? THIN_SPACE : '')
}

export function normalizeAnswer(input: string): string {
  return input.replace(/\s+/gu, '')
}

export function scoreLongNumber(groups: string[], input: string): AlignResult {
  return alignStrings(groups.join(''), normalizeAnswer(input))
}

export function summarizeLongNumber(rounds: RoundRecord[]): GameSummary {
  if (rounds.length === 0) return { headline: 'not played', stats: [] }
  const perfect = rounds.filter((r) => r.success).map((r) => r.metrics.length ?? 0)
  const best = perfect.length > 0 ? Math.max(...perfect) : null
  const recent = rounds.slice(-10).map((r) => r.accuracy ?? 0)
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length
  return {
    headline: best === null ? 'no perfect round yet' : `best ${best}`,
    stats: [
      { label: 'Rounds', value: String(rounds.length) },
      { label: 'Best (100%)', value: best === null ? '—' : `${best} digits` },
      { label: 'Average accuracy (last 10)', value: `${Math.round(avg * 100)}%` },
    ],
  }
}
