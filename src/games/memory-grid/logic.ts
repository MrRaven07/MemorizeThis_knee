import type { StaircaseConfig } from '@/core/difficulty/staircase'
import type { Rng } from '@/core/random/rng'
import type { GameSettings, GameSummary, RoundRecord, SettingField } from '@/games/types'

/**
 * Memory Grid: a pattern of lit cells is shown briefly, then everything turns
 * off and the player rebuilds it by tapping. Spatial visual memory. Proposed
 * by the owner; rules in question 015.
 */
export const MEMORY_GRID_ID = 'memory-grid'

export interface MemoryGridSettings extends GameSettings {
  timeMultiplier: number
  upAfter: number
}

export const MEMORY_GRID_DEFAULTS: MemoryGridSettings = { timeMultiplier: 1, upAfter: 3 }

export const MEMORY_GRID_FIELDS: SettingField[] = [
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

export interface GridLevel {
  size: number
  lit: number
}

/** Difficulty curve (question 015). Index 0 = level 1. */
export const GRID_LEVELS: readonly GridLevel[] = [
  { size: 3, lit: 3 },
  { size: 3, lit: 4 },
  { size: 4, lit: 5 },
  { size: 4, lit: 6 },
  { size: 4, lit: 7 },
  { size: 5, lit: 8 },
  { size: 5, lit: 9 },
  { size: 5, lit: 10 },
  { size: 6, lit: 11 },
  { size: 6, lit: 12 },
  { size: 6, lit: 14 },
  { size: 7, lit: 16 },
]

export function gridStaircase(s: MemoryGridSettings): StaircaseConfig {
  return {
    start: 1,
    min: 1,
    max: GRID_LEVELS.length,
    upAfter: s.upAfter,
    upStep: 1,
    downAfter: 1,
    downStep: 1,
  }
}

export function gridLevelInfo(level: number): GridLevel {
  const i = Math.min(GRID_LEVELS.length, Math.max(1, Math.round(level))) - 1
  return GRID_LEVELS[i]!
}

/** 1.0 s + 0.15 s per lit cell, scaled by the setting; never under 0.5 s. */
export function gridViewMs(level: number, multiplier: number): number {
  return Math.max(500, Math.round((1000 + 150 * gridLevelInfo(level).lit) * multiplier))
}

/** Sorted distinct cell indices; never the same pattern twice in a row. */
export function generatePattern(
  rng: Rng,
  size: number,
  lit: number,
  previous?: number[],
): number[] {
  const cells = Array.from({ length: size * size }, (_, i) => i)
  for (let tries = 0; ; tries++) {
    const p = rng
      .shuffle(cells)
      .slice(0, lit)
      .sort((a, b) => a - b)
    const same = previous && previous.length === p.length && previous.every((c, i) => c === p[i])
    if (!same || tries > 50) return p
  }
}

export interface GridScore {
  hits: number
  misses: number
  wrong: number
  exact: boolean
  /** hits / (hits + misses + wrong) — tapping every cell scores low */
  accuracy: number
}

export function scoreGrid(pattern: number[], answer: number[]): GridScore {
  const want = new Set(pattern)
  const got = new Set(answer)
  const hits = [...got].filter((c) => want.has(c)).length
  const wrong = got.size - hits
  const misses = want.size - hits
  const denom = hits + misses + wrong
  return {
    hits,
    misses,
    wrong,
    exact: misses === 0 && wrong === 0,
    accuracy: denom === 0 ? 0 : hits / denom,
  }
}

export function summarizeMemoryGrid(rounds: RoundRecord[]): GameSummary {
  if (rounds.length === 0) return { headline: 'not played', stats: [] }
  const wins = rounds.filter((r) => r.success).map((r) => r.level ?? 0)
  const best = wins.length > 0 ? Math.max(...wins) : null
  const last10 = rounds.slice(-10)
  const acc = last10.reduce((a, r) => a + (r.accuracy ?? 0), 0) / last10.length
  const last20 = rounds.slice(-20)
  const pct = Math.round((last20.filter((r) => r.success).length / last20.length) * 100)
  return {
    headline: best === null ? 'no perfect round yet' : `best level ${best}`,
    stats: [
      { label: 'Rounds', value: String(rounds.length) },
      { label: 'Best level', value: best === null ? '—' : String(best) },
      { label: 'Accuracy (last 10)', value: `${Math.round(acc * 100)}%` },
      { label: 'Success (last 20)', value: `${pct}%` },
    ],
  }
}
