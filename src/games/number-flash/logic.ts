import { alignStrings, type AlignResult } from '@/core/scoring/align'
import type { StaircaseConfig } from '@/core/difficulty/staircase'
import type { GameSettings, GameSummary, RoundRecord, SettingField } from '@/games/types'

/**
 * Number Flash: a short number is revealed digit by digit, hidden, then typed
 * back. Its length adapts (staircase), so the player always trains at the edge
 * of their digit span. Spec §6.2, questions 005/006.
 */
export const NUMBER_FLASH_ID = 'number-flash'

export interface NumberFlashSettings extends GameSettings {
  revealMode: 'gradual' | 'all'
  revealMsPerDigit: number
  baseDisplaySeconds: number
  extraSecondsPerDigit: number
  upAfter: number
  upStep: number
}

export const NUMBER_FLASH_DEFAULTS: NumberFlashSettings = {
  revealMode: 'gradual',
  revealMsPerDigit: 250,
  baseDisplaySeconds: 4,
  extraSecondsPerDigit: 0.5,
  upAfter: 3,
  upStep: 1,
}

export const NUMBER_FLASH_FIELDS: SettingField[] = [
  {
    key: 'revealMode',
    label: 'How digits appear',
    type: 'select',
    options: [
      { value: 'gradual', label: 'One digit at a time' },
      { value: 'all', label: 'All at once' },
    ],
  },
  {
    key: 'revealMsPerDigit',
    label: 'Time between digits',
    type: 'number',
    min: 50,
    max: 2000,
    step: 50,
    unit: 'ms',
    help: 'if the reveal is slow, the full number still stays visible for at least 1 s',
  },
  {
    key: 'baseDisplaySeconds',
    label: 'Display time',
    type: 'number',
    min: 1,
    max: 30,
    step: 0.5,
    unit: 's',
  },
  {
    key: 'extraSecondsPerDigit',
    label: 'Extra time per digit',
    type: 'number',
    min: 0,
    max: 3,
    step: 0.25,
    unit: 's',
    help: 'added per digit beyond 4',
  },
  { key: 'upAfter', label: 'Correct in a row to level up', type: 'number', min: 3, max: 5 },
  { key: 'upStep', label: 'Digits added per level up', type: 'number', min: 1, max: 2 },
]

export function numberFlashStaircase(s: NumberFlashSettings): StaircaseConfig {
  return {
    start: 4,
    min: 3,
    max: 30,
    upAfter: s.upAfter,
    upStep: s.upStep,
    downAfter: 1,
    downStep: 1,
  }
}

export interface RevealSchedule {
  /** when each digit appears, in ms from the round start */
  digitAtMs: number[]
  /** when the whole number hides, in ms from the round start */
  hideAtMs: number
}

export function revealSchedule(length: number, s: NumberFlashSettings): RevealSchedule {
  const digitAtMs = Array.from({ length }, (_, i) =>
    s.revealMode === 'gradual' ? i * s.revealMsPerDigit : 0,
  )
  const lastDigitAt = digitAtMs.at(-1) ?? 0
  const display =
    s.baseDisplaySeconds * 1000 + s.extraSecondsPerDigit * 1000 * Math.max(0, length - 4)
  // The complete number is always visible for at least 1 s (question 005).
  return { digitAtMs, hideAtMs: Math.max(display, lastDigitAt + 1000) }
}

export function visibleDigits(schedule: RevealSchedule, elapsedMs: number): number {
  return schedule.digitAtMs.filter((t) => t <= elapsedMs).length
}

export function scoreFlash(target: string, input: string): AlignResult {
  return alignStrings(target, input.replace(/\s+/gu, ''))
}

export function summarizeNumberFlash(rounds: RoundRecord[]): GameSummary {
  if (rounds.length === 0) return { headline: 'not played', stats: [] }
  const correct = rounds.filter((r) => r.success).map((r) => r.metrics.length ?? 0)
  const longest = correct.length > 0 ? Math.max(...correct) : null
  const recent = rounds.slice(-20)
  const successPct = Math.round((recent.filter((r) => r.success).length / recent.length) * 100)
  return {
    headline: longest === null ? 'no correct answer yet' : `longest ${longest}`,
    stats: [
      { label: 'Rounds', value: String(rounds.length) },
      { label: 'Longest correct', value: longest === null ? '—' : `${longest} digits` },
      { label: 'Last length', value: String(rounds.at(-1)!.level ?? '—') },
      { label: 'Success (last 20)', value: `${successPct}%` },
    ],
  }
}
