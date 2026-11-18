import type { StaircaseConfig } from '@/core/difficulty/staircase'
import type { Rng } from '@/core/random/rng'
import type { GameSettings, GameSummary, RoundRecord, SettingField } from '@/games/types'
import { KIM_OBJECTS } from './objects'

/**
 * Kim's Game: a tray of objects is shown, then hidden. The player picks every
 * object that was on it (`list`) or the ones that went missing (`missing`).
 * Trains rapid visual encoding of many objects and their places. Added at the
 * owner's request; rules in question 017.
 */
export const KIMS_GAME_ID = 'kims-game'

export type KimMode = 'list' | 'missing'
export const KIM_MODES: readonly KimMode[] = ['list', 'missing']

export interface KimsGameSettings extends GameSettings {
  mode: KimMode
  timeMultiplier: number
  upAfter: number
}

export const KIMS_GAME_DEFAULTS: KimsGameSettings = { mode: 'list', timeMultiplier: 1, upAfter: 3 }

export const KIMS_GAME_FIELDS: SettingField[] = [
  {
    key: 'mode',
    label: 'Mode',
    type: 'select',
    options: [
      { value: 'list', label: 'List all objects' },
      { value: 'missing', label: "What's missing" },
    ],
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

/** The tray is a 5×4 grid; free cells stay empty. */
export const TRAY_COLS = 5
export const TRAY_ROWS = 4
export const TRAY_CELLS = TRAY_COLS * TRAY_ROWS
/** Blank between the tray hiding and coming back in `missing` mode. */
export const GAP_MS = 1000

/** A tray: one object id per cell, or null for an empty cell. */
export type Tray = (string | null)[]

export interface KimLevel {
  objects: number
  /** objects removed in `missing` mode (0 in `list`) */
  missing: number
}

const objectsAt = (i: number) => 10 + i
const missingAt = (i: number) => (i < 4 ? 1 : i < 8 ? 2 : 3)

/** Difficulty curve (question 017). Index 0 = level 1. */
export const KIM_LEVELS: Readonly<Record<KimMode, readonly KimLevel[]>> = {
  list: Array.from({ length: 11 }, (_, i) => ({ objects: objectsAt(i), missing: 0 })),
  missing: Array.from({ length: 11 }, (_, i) => ({ objects: objectsAt(i), missing: missingAt(i) })),
}

/** Each mode keeps its own level, so one mode can't drag the other down. */
export const levelKey = (mode: KimMode) => `${KIMS_GAME_ID}:${mode}`

export const modeCode = (mode: KimMode) => KIM_MODES.indexOf(mode)

export function kimStaircase(s: KimsGameSettings): StaircaseConfig {
  return {
    start: 1,
    min: 1,
    max: KIM_LEVELS.list.length,
    upAfter: s.upAfter,
    upStep: 1,
    downAfter: 1,
    downStep: 1,
  }
}

export function kimLevelInfo(mode: KimMode, level: number): KimLevel {
  const levels = KIM_LEVELS[mode]
  const i = Math.min(levels.length, Math.max(1, Math.round(level))) - 1
  return levels[i]!
}

/** 2 s + 0.8 s per object, scaled by the setting; never under 1 s. */
export function kimViewMs(objects: number, multiplier: number): number {
  return Math.max(1000, Math.round((2000 + 800 * objects) * multiplier))
}

/** The object ids on a tray, in reading order (row by row). */
export function trayObjects(tray: Tray): string[] {
  return tray.filter((id): id is string => id !== null)
}

const sameTray = (a: Tray, b: Tray) => a.length === b.length && a.every((id, i) => id === b[i])

/** `count` distinct objects in random cells; never the same tray twice in a row. */
export function generateTray(rng: Rng, count: number, previous?: Tray): Tray {
  const n = Math.min(count, TRAY_CELLS, KIM_OBJECTS.length)
  const cells = Array.from({ length: TRAY_CELLS }, (_, i) => i)
  for (let tries = 0; ; tries++) {
    const picked = rng.shuffle(KIM_OBJECTS).slice(0, n)
    const places = rng.shuffle(cells).slice(0, n)
    const tray: Tray = Array(TRAY_CELLS).fill(null)
    places.forEach((cell, i) => (tray[cell] = picked[i]!.id))
    if (!previous || !sameTray(tray, previous) || tries > 50) return tray
  }
}

/** `k` distinct objects from the tray, to be taken away. */
export function chooseMissing(rng: Rng, tray: Tray, k: number): string[] {
  return rng.shuffle(trayObjects(tray)).slice(0, k)
}

/** The tray with the missing objects removed; everything else stays in its cell. */
export function partialTray(tray: Tray, missing: string[]): Tray {
  const gone = new Set(missing)
  return tray.map((id) => (id !== null && gone.has(id) ? null : id))
}

function distractors(rng: Rng, tray: Tray, count: number): string[] {
  const onTray = new Set(trayObjects(tray))
  return rng
    .shuffle(KIM_OBJECTS.filter((o) => !onTray.has(o.id)))
    .slice(0, count)
    .map((o) => o.id)
}

/**
 * `list` mode: every tray object plus the same number of distractors (never on
 * the tray), shuffled so the tray objects don't come in their tray order.
 */
export function listPicker(rng: Rng, tray: Tray): string[] {
  const ids = trayObjects(tray)
  const all = [...ids, ...distractors(rng, tray, ids.length)]
  const onTray = new Set(ids)
  for (let tries = 0; ; tries++) {
    const picker = rng.shuffle(all)
    const order = picker.filter((id) => onTray.has(id))
    if (ids.length < 2 || !order.every((id, i) => id === ids[i]) || tries > 50) return picker
  }
}

/** `missing` mode: the k missing objects plus max(4, 2k) distractors not on the tray. */
export function missingPicker(rng: Rng, tray: Tray, missing: string[]): string[] {
  const k = missing.length
  return rng.shuffle([...missing, ...distractors(rng, tray, Math.max(4, 2 * k))])
}

export interface KimScore {
  hits: number
  misses: number
  wrong: number
  exact: boolean
  /** hits / (hits + misses + wrong) — picking everything scores low */
  accuracy: number
}

export function scoreKim(correct: string[], picked: string[]): KimScore {
  const want = new Set(correct)
  const got = new Set(picked)
  const hits = [...got].filter((id) => want.has(id)).length
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

export function summarizeKimsGame(rounds: RoundRecord[]): GameSummary {
  if (rounds.length === 0) return { headline: 'not played', stats: [] }
  const bestOf = (rs: RoundRecord[]) => {
    const wins = rs.filter((r) => r.success).map((r) => r.metrics.objects ?? 0)
    return wins.length > 0 ? Math.max(...wins) : null
  }
  const show = (n: number | null) => (n === null ? '—' : `${n} objects`)
  const best = bestOf(rounds)
  const perMode = KIM_MODES.map((mode, code) => ({
    label: `Best (${mode})`,
    value: show(bestOf(rounds.filter((r) => (r.metrics.mode ?? 0) === code))),
  }))
  const last10 = rounds.slice(-10)
  const acc = last10.reduce((a, r) => a + (r.accuracy ?? 0), 0) / last10.length
  const last20 = rounds.slice(-20)
  const pct = Math.round((last20.filter((r) => r.success).length / last20.length) * 100)
  return {
    headline: best === null ? 'no perfect round yet' : `best ${best} objects`,
    stats: [
      { label: 'Rounds', value: String(rounds.length) },
      ...perMode,
      { label: 'Accuracy (last 10)', value: `${Math.round(acc * 100)}%` },
      { label: 'Success (last 20)', value: `${pct}%` },
    ],
  }
}
