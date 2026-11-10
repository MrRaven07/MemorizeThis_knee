/**
 * The ONLY door to persistent storage. Today it is localStorage; on Android
 * (Capacitor) it can be swapped without touching stores or games.
 */
export interface StorageAdapter {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
  keys(): string[]
}

export function createMemoryAdapter(initial: Record<string, string> = {}): StorageAdapter {
  const map = new Map(Object.entries(initial))
  return {
    get: (k) => map.get(k) ?? null,
    set: (k, v) => void map.set(k, v),
    remove: (k) => void map.delete(k),
    keys: () => [...map.keys()],
  }
}

/** localStorage, degrading to memory if it is unavailable (private mode, blocked site data). */
export function createLocalStorageAdapter(): StorageAdapter {
  let ls: Storage | null = null
  try {
    ls = globalThis.localStorage
    const probe = '__mt_probe__'
    ls.setItem(probe, '1')
    ls.removeItem(probe)
  } catch {
    ls = null
  }
  if (!ls) return createMemoryAdapter()
  const storage = ls
  const fallback = createMemoryAdapter()
  return {
    get: (k) => {
      try {
        return storage.getItem(k)
      } catch {
        return fallback.get(k)
      }
    },
    set: (k, v) => {
      try {
        storage.setItem(k, v)
      } catch {
        fallback.set(k, v)
      }
    },
    remove: (k) => {
      try {
        storage.removeItem(k)
      } catch {
        fallback.remove(k)
      }
    },
    keys: () => {
      try {
        return Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(
          (k): k is string => k !== null,
        )
      } catch {
        return fallback.keys()
      }
    },
  }
}
