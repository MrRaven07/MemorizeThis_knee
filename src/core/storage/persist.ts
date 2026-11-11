import { createLocalStorageAdapter, type StorageAdapter } from './adapter'

export const KEY_PREFIX = 'mt:'
export const VERSION_KEY = 'mt:version'
/**
 * Bump this AND add a migration whenever the saved data shape changes.
 * Never delete user data in a migration — transform it.
 */
export const SCHEMA_VERSION = 2

/** Upgrades storage from version n-1 to n (the key is n). */
export type Migration = (a: StorageAdapter) => void

export const migrations: Record<number, Migration> = {
  1: () => {
    // v1 is the first schema: nothing to transform.
  },
  2: (a) => {
    // Sessions now count flashcard answers: add `cards: 0` where missing.
    const withCards = (r: unknown) =>
      typeof r === 'object' && r !== null && !Array.isArray(r) && !('cards' in r)
        ? { ...r, cards: 0 }
        : r
    const patch = (key: string, fn: (v: unknown) => unknown) => {
      const raw = a.get(key)
      if (raw === null) return
      try {
        a.set(key, JSON.stringify(fn(JSON.parse(raw))))
      } catch {
        // corrupt values are left alone; the stores' guards deal with them
      }
    }
    patch('mt:sessions', (v) => (Array.isArray(v) ? v.map(withCards) : v))
    patch('mt:session-current', withCards)
  },
}

export function runMigrations(
  a: StorageAdapter,
  list: Record<number, Migration> = migrations,
  target: number = SCHEMA_VERSION,
): 'ok' | 'future-version' {
  const raw = a.get(VERSION_KEY)
  const current = raw === null ? 0 : Number.parseInt(raw, 10) || 0
  if (current > target) return 'future-version'
  for (let v = current + 1; v <= target; v++) {
    list[v]?.(a)
    a.set(VERSION_KEY, String(v))
  }
  return 'ok'
}

/**
 * Reads a JSON value. If it can't be parsed — or `isValid` rejects its shape —
 * the raw text is kept under `<key>.corrupt` and `fallback` is returned.
 */
export function loadJson<T>(
  a: StorageAdapter,
  key: string,
  fallback: T,
  isValid?: (value: unknown) => boolean,
): T {
  const raw = a.get(key)
  if (raw === null) return fallback
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    keepCorrupt(a, key, raw)
    return fallback
  }
  if (isValid && !isValid(value)) {
    keepCorrupt(a, key, raw)
    return fallback
  }
  return value as T
}

function keepCorrupt(a: StorageAdapter, key: string, raw: string) {
  const corruptKey = `${key}.corrupt`
  if (a.get(corruptKey) === null) a.set(corruptKey, raw)
}

/** Shape guard: a plain object (not null, not an array). */
export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function saveJson(a: StorageAdapter, key: string, value: unknown): void {
  a.set(key, JSON.stringify(value))
}

/** The adapter every store uses. Tests replace it with `vi.mock`. */
export const appStorage: StorageAdapter = createLocalStorageAdapter()
