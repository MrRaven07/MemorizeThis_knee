import type { StaircaseConfig } from '@/core/difficulty/staircase'
import type { Rng } from '@/core/random/rng'
import type { GameSettings, GameSummary, RoundRecord, SettingField } from '@/games/types'
import type { FaceSpec } from './faces'
import { nameSets, type NameSet } from './names'

/**
 * Names & Faces: study faces with their names, then name each face again.
 * The memory-sport discipline — link a striking feature to an image of the
 * name. Added at the owner's request; rules in question 016.
 */
export const NAMES_FACES_ID = 'names-faces'

export interface NamesFacesSettings extends GameSettings {
  country: string
  nameStyle: 'first' | 'full'
  secondsPerFace: number
  upAfter: number
}

export const NAMES_FACES_DEFAULTS: NamesFacesSettings = {
  country: 'ro',
  nameStyle: 'first',
  secondsPerFace: 6,
  upAfter: 3,
}

export const NAMES_FACES_FIELDS: SettingField[] = [
  {
    key: 'country',
    label: 'Names from',
    type: 'select',
    options: nameSets.map((n) => ({ value: n.id, label: n.name })),
  },
  {
    key: 'nameStyle',
    label: 'Names',
    type: 'select',
    options: [
      { value: 'first', label: 'First names' },
      { value: 'full', label: 'First and last names' },
    ],
  },
  {
    key: 'secondsPerFace',
    label: 'Study time per face',
    type: 'number',
    min: 3,
    max: 15,
    unit: 's',
  },
  { key: 'upAfter', label: 'Passed rounds in a row to level up', type: 'number', min: 3, max: 5 },
]

/** Faces per round for levels 1–10. */
export const NF_LEVELS: readonly number[] = [3, 4, 5, 6, 8, 10, 12, 15, 18, 20]
export const PASS_ACCURACY = 0.9
export const DROP_ACCURACY = 0.5

export function nfStaircase(s: NamesFacesSettings): StaircaseConfig {
  return {
    start: 1,
    min: 1,
    max: NF_LEVELS.length,
    upAfter: s.upAfter,
    upStep: 1,
    downAfter: 1,
    downStep: 1,
  }
}

export function nfLevelFaces(level: number): number {
  const i = Math.min(NF_LEVELS.length, Math.max(1, Math.round(level))) - 1
  return NF_LEVELS[i]!
}

/**
 * Comparison key (question 016): NFC → NFD → strip marks → Romanian
 * lowercase → hyphens as spaces → collapse whitespace → trim.
 * Diacritic-insensitive for slow phone keyboards; no typo tolerance.
 */
export function foldName(s: string): string {
  return s
    .normalize('NFC')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('ro')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface Person {
  face: FaceSpec
  first: string
  /** '' in first-name mode */
  last: string
}

/** First names match the face's presentation; no first (or last) name repeats in a round. */
export function assignNames(
  rng: Rng,
  faces: FaceSpec[],
  set: NameSet,
  style: 'first' | 'full',
): Person[] {
  const used = new Set<string>()
  const usedLast = new Set<string>()
  const pickUnique = (list: readonly string[], seen: Set<string>) => {
    const free = list.filter((n) => !seen.has(foldName(n)))
    const name = rng.pick(free.length > 0 ? free : list)
    seen.add(foldName(name))
    return name
  }
  return faces.map((face) => {
    const first = pickUnique(face.presentation === 'f' ? set.female : set.male, used)
    if (style !== 'full') return { face, first, last: '' }
    // never "Radu Radu": the surname must differ from the first name
    const avoid = new Set([...usedLast, foldName(first)])
    const last = pickUnique(set.last, avoid)
    usedLast.add(foldName(last))
    return { face, first, last }
  })
}

export function scorePerson(
  p: Pick<Person, 'first' | 'last'>,
  first: string,
  last: string,
  full: boolean,
): { points: number; firstOk: boolean; lastOk: boolean } {
  const firstOk = foldName(first) !== '' && foldName(first) === foldName(p.first)
  if (!full) return { points: firstOk ? 1 : 0, firstOk, lastOk: false }
  const lastOk = foldName(last) !== '' && foldName(last) === foldName(p.last)
  return { points: (firstOk ? 0.5 : 0) + (lastOk ? 0.5 : 0), firstOk, lastOk }
}

export function nfOutcome(accuracy: number): 'pass' | 'stay' | 'drop' {
  if (accuracy >= PASS_ACCURACY) return 'pass'
  if (accuracy < DROP_ACCURACY) return 'drop'
  return 'stay'
}

export function summarizeNamesFaces(rounds: RoundRecord[]): GameSummary {
  if (rounds.length === 0) return { headline: 'not played', stats: [] }
  const wins = rounds.filter((r) => r.success)
  const best = wins.length > 0 ? Math.max(...wins.map((r) => r.level ?? 0)) : null
  const most = wins.length > 0 ? Math.max(...wins.map((r) => r.metrics.faces ?? 0)) : null
  const last10 = rounds.slice(-10)
  const acc = last10.reduce((a, r) => a + (r.accuracy ?? 0), 0) / last10.length
  const last20 = rounds.slice(-20)
  const pct = Math.round((last20.filter((r) => r.success).length / last20.length) * 100)
  return {
    headline: best === null ? 'no round passed yet' : `best level ${best}`,
    stats: [
      { label: 'Rounds', value: String(rounds.length) },
      { label: 'Best level', value: best === null ? '—' : String(best) },
      { label: 'Most faces in a passed round', value: most === null ? '—' : String(most) },
      { label: 'Accuracy (last 10)', value: `${Math.round(acc * 100)}%` },
      { label: 'Success (last 20)', value: `${pct}%` },
    ],
  }
}
