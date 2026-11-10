import type { Rng } from '@/core/random/rng'
import type { Plate, PlateFormat } from './types'

/**
 * Romanian standard plates (format since 1992; EU band since 2007).
 *
 * Source: https://en.wikipedia.org/wiki/Vehicle_registration_plates_of_Romania
 * - Format `CC 12 ABC`; Bucharest `B 12 ABC` or `B 123 ABC`.
 * - "`00` is not a valid number."
 * - "The letter `Q` is not used as it may be confused with the letter `O`."
 * - "The three-letter code may not start with `I` or `O`."
 * - Groups reserved for official bodies (POL, DEP, SNT, SRI, GUV) are not issued.
 * - Black characters on white; blue EU band with "RO"; DIN 1451 font; 520 × 110 mm.
 */
export const RO_COUNTIES = [
  'B',
  'AB',
  'AG',
  'AR',
  'BC',
  'BH',
  'BN',
  'BR',
  'BT',
  'BV',
  'BZ',
  'CJ',
  'CL',
  'CS',
  'CT',
  'CV',
  'DB',
  'DJ',
  'GJ',
  'GL',
  'GR',
  'HD',
  'HR',
  'IF',
  'IL',
  'IS',
  'MH',
  'MM',
  'MS',
  'NT',
  'OT',
  'PH',
  'SB',
  'SJ',
  'SM',
  'SV',
  'TL',
  'TM',
  'TR',
  'VL',
  'VN',
  'VS',
] as const

export const RO_RESERVED = ['POL', 'DEP', 'SNT', 'SRI', 'GUV'] as const

const LETTERS = 'ABCDEFGHIJKLMNOPRSTUVWXYZ' // no Q
const FIRST_LETTERS = LETTERS.replace(/[IO]/g, '')

const counties = new Set<string>(RO_COUNTIES)
const reserved = new Set<string>(RO_RESERVED)

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function generate(rng: Rng): Plate {
  const county = rng.pick(RO_COUNTIES)
  const digits =
    county === 'B' && rng.next() < 0.5 ? String(rng.int(100, 999)) : pad2(rng.int(1, 99))
  let letters: string
  do {
    letters =
      FIRST_LETTERS[rng.int(0, FIRST_LETTERS.length - 1)]! +
      LETTERS[rng.int(0, LETTERS.length - 1)]! +
      LETTERS[rng.int(0, LETTERS.length - 1)]!
  } while (reserved.has(letters))
  const segments = [county, digits, letters]
  return { country: 'ro', segments, text: segments.join(' ') }
}

function isValid(text: string): boolean {
  const m = /^([A-Z]{1,2}) (\d{2,3}) ([A-Z]{3})$/.exec(text)
  if (!m) return false
  const [, county, digits, letters] = m as unknown as [string, string, string, string]
  if (!counties.has(county)) return false
  if (digits.length === 3 ? county !== 'B' || Number(digits) < 100 : digits === '00') return false
  if (letters.includes('Q') || letters[0] === 'I' || letters[0] === 'O') return false
  return !reserved.has(letters)
}

export const ro: PlateFormat = {
  id: 'ro',
  name: 'Romania',
  generate,
  isValid,
  style: {
    background: '#ffffff',
    foreground: '#111111',
    bandColor: '#003399',
    bandLabel: 'RO',
    bandStars: true,
    aspect: 520 / 110,
    fontFamily: "'DIN 1451', 'D-DIN', 'Bahnschrift', 'DIN Alternate', 'Arial Narrow', sans-serif",
  },
}
