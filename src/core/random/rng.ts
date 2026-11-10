/**
 * Seedable random number generator. ALL randomness in the app goes through this,
 * so tests can pass a seed and get the exact same digits, plates, mazes, etc.
 */
export interface Rng {
  /** A float in [0, 1). */
  next(): number
  /** An integer in [min, max], both inclusive. */
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
  /** Returns a new shuffled array; the input is not modified. */
  shuffle<T>(items: readonly T[]): T[]
}

function randomSeed(): number {
  const buf = new Uint32Array(1)
  globalThis.crypto.getRandomValues(buf)
  return buf[0]!
}

/** mulberry32 — tiny, fast and good enough for games. */
export function createRng(seed: number = randomSeed()): Rng {
  let state = seed >>> 0

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1))

  return {
    next,
    int,
    pick: (items) => {
      if (items.length === 0) throw new Error('pick() needs a non-empty list')
      return items[int(0, items.length - 1)]!
    },
    shuffle: (items) => {
      const out = [...items]
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i)
        ;[out[i], out[j]] = [out[j]!, out[i]!]
      }
      return out
    },
  }
}

export function randomDigits(rng: Rng, length: number): string {
  let s = ''
  for (let i = 0; i < length; i++) s += String(rng.int(0, 9))
  return s
}
