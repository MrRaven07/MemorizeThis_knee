import type { Rng } from '@/core/random/rng'

/** One license plate, e.g. segments ['B', '505', 'LSK'] → text 'B 505 LSK'. */
export interface Plate {
  /** PlateFormat id, e.g. 'ro' */
  country: string
  segments: string[]
  /** segments joined by a single space */
  text: string
}

/**
 * How a plate looks. These are real-world colors (not theme tokens), so they
 * live with the country format.
 */
export interface PlateStyle {
  background: string
  foreground: string
  bandColor: string
  bandLabel: string
  bandStars: boolean
  /** width / height of the real plate */
  aspect: number
  fontFamily: string
}

/**
 * A country's plate format. Add a country = add one file implementing this
 * (see .claude/skills/add-plate-country).
 */
export interface PlateFormat {
  id: string
  name: string
  generate(rng: Rng): Plate
  isValid(text: string): boolean
  style: PlateStyle
}
