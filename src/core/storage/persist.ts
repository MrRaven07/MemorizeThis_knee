import { createLocalStorageAdapter, type StorageAdapter } from './adapter'

export const KEY_PREFIX = 'mt:'
export const VERSION_KEY = 'mt:version'
/**
 * Bump this AND add a migration whenever the saved data shape changes.
 * Never delete user data in a migration — transform it.
 */
export const SCHEMA_VERSION = 1

/** Upgrades storage from version n-1 to n (the key is n). */
export type Migration = (a: StorageAdapter) => void

export const migrations: Record<number, Migration> = {
  1: () => {
    // v1 is the first schema: nothing to transform.
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

export function loadJson<T>(a: StorageAdapter, key: string, fallback: T): T {
  const raw = a.get(key)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    const corruptKey = `${key}.corrupt`
    if (a.get(corruptKey) === null) a.set(corruptKey, raw)
    return fallback
  }
}

export function saveJson(a: StorageAdapter, key: string, value: unknown): void {
  a.set(key, JSON.stringify(value))
}

/** The adapter every store uses. Tests replace it with `vi.mock`. */
export const appStorage: StorageAdapter = createLocalStorageAdapter()
