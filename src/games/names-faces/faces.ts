import type { Rng } from '@/core/random/rng'

/**
 * Original, procedurally generated faces (no photos, no external art).
 *
 * The skin / hair / eye palettes below are CONTENT data (they describe
 * people), not UI colours — the one documented exception to "colours come
 * from tokens" (question 016). Card chrome and backgrounds still use tokens.
 */
export const SKIN = ['#f6d7c3', '#eac09a', '#d39c72', '#b5794e', '#8a5534', '#5e3a22'] as const
export const SKIN_NAMES = ['very light', 'light', 'medium', 'tan', 'brown', 'dark'] as const
export const HAIR_COLORS = [
  '#1c1714',
  '#4a2f1d',
  '#8a5a2b',
  '#c99a4b',
  '#b3471f',
  '#8f8f8f',
  '#e8e2d4',
] as const
export const HAIR_COLOR_NAMES = [
  'black',
  'dark brown',
  'brown',
  'blond',
  'red',
  'grey',
  'white',
] as const
export const EYE_COLORS = ['#3b2a1e', '#5b7a3a', '#3f6e9e', '#6b6b6b'] as const

/** Hair styles; `f`/`m` lists steer which styles each presentation can get. */
export const HAIR_STYLES = [
  'bald',
  'buzz cut',
  'short',
  'side part',
  'curly short',
  'spiky',
  'long straight',
  'long wavy',
  'bob',
  'bun',
  'ponytail',
  'curly long',
] as const
const STYLES_F = [2, 3, 4, 6, 7, 8, 9, 10, 11]
const STYLES_M = [0, 1, 2, 3, 4, 5, 6, 10]
export const FACE_SHAPES = ['round', 'oval', 'square', 'long'] as const
export const FACIAL_HAIR = ['none', 'beard', 'moustache', 'stubble'] as const

export interface FaceSpec {
  presentation: 'f' | 'm'
  shape: number
  skin: number
  hairStyle: number
  hairColor: number
  eyeColor: number
  glasses: boolean
  facialHair: number
  earrings: boolean
  freckles: boolean
}

function randomFace(rng: Rng): FaceSpec {
  const presentation = rng.next() < 0.5 ? 'f' : 'm'
  const f = presentation === 'f'
  return {
    presentation,
    shape: rng.int(0, FACE_SHAPES.length - 1),
    skin: rng.int(0, SKIN.length - 1),
    hairStyle: rng.pick(f ? STYLES_F : STYLES_M),
    hairColor: rng.int(0, HAIR_COLORS.length - 1),
    eyeColor: rng.int(0, EYE_COLORS.length - 1),
    glasses: rng.next() < 0.3,
    facialHair: f ? 0 : rng.next() < 0.5 ? rng.int(1, FACIAL_HAIR.length - 1) : 0,
    earrings: rng.next() < (f ? 0.5 : 0.12),
    freckles: rng.next() < 0.2,
  }
}

/** How many SALIENT features differ (the ones visible at a glance). */
export function faceDifferences(a: FaceSpec, b: FaceSpec): number {
  return (
    Number(a.hairStyle !== b.hairStyle) +
    Number(a.hairColor !== b.hairColor) +
    Number(a.shape !== b.shape) +
    Number(a.glasses !== b.glasses) +
    Number(a.facialHair !== b.facialHair) +
    Number(a.skin !== b.skin) +
    Number(a.earrings !== b.earrings)
  )
}

/** `n` faces where any two differ in at least 3 salient features. */
export function generateFaces(rng: Rng, n: number): FaceSpec[] {
  const faces: FaceSpec[] = []
  for (let tries = 0; faces.length < n; tries++) {
    const f = randomFace(rng)
    const minDiff = tries < 5000 ? 3 : 2 // practically never relaxed
    if (faces.every((g) => faceDifferences(f, g) >= minDiff)) faces.push(f)
  }
  return faces
}

/** Short description for screen readers, e.g. "long wavy red hair, glasses". */
export function describeFace(f: FaceSpec): string {
  const parts = [
    f.hairStyle === 0
      ? 'bald'
      : `${HAIR_STYLES[f.hairStyle]} ${HAIR_COLOR_NAMES[f.hairColor]} hair`,
    `${FACE_SHAPES[f.shape]} face`,
    `${SKIN_NAMES[f.skin]} skin`,
  ]
  if (f.glasses) parts.push('glasses')
  if (f.facialHair) parts.push(FACIAL_HAIR[f.facialHair]!)
  if (f.earrings) parts.push('earrings')
  if (f.freckles) parts.push('freckles')
  return parts.join(', ')
}
