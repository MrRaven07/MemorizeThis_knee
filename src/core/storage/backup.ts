import type { StorageAdapter } from './adapter'
import { KEY_PREFIX, runMigrations, SCHEMA_VERSION } from './persist'

const APP_ID = 'memorize-this'

interface BackupFile {
  app: typeof APP_ID
  exportedAt: number
  version: number
  data: Record<string, string>
}

export function exportAll(a: StorageAdapter): string {
  const data: Record<string, string> = {}
  for (const key of a.keys()) {
    if (!key.startsWith(KEY_PREFIX)) continue
    const value = a.get(key)
    if (value !== null) data[key] = value
  }
  const file: BackupFile = { app: APP_ID, exportedAt: Date.now(), version: SCHEMA_VERSION, data }
  return JSON.stringify(file, null, 2)
}

function validate(json: string): { ok: true; file: BackupFile } | { ok: false; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' }
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'This file is not a MemorizeThis backup.' }
  }
  const f = parsed as Partial<BackupFile>
  if (f.app !== APP_ID) return { ok: false, error: 'This file is not a MemorizeThis backup.' }
  if (typeof f.version !== 'number' || f.version > SCHEMA_VERSION) {
    return { ok: false, error: 'This backup comes from a newer version of MemorizeThis. Update the app first.' }
  }
  if (typeof f.data !== 'object' || f.data === null) {
    return { ok: false, error: 'This backup has no data.' }
  }
  for (const [k, v] of Object.entries(f.data)) {
    if (!k.startsWith(KEY_PREFIX) || typeof v !== 'string') {
      return { ok: false, error: 'This backup is damaged (unexpected entry).' }
    }
  }
  return { ok: true, file: f as BackupFile }
}

/**
 * REPLACES all MemorizeThis data with the backup's (see docs/agents/questions/003).
 * Writes nothing unless the whole file is valid. The UI must confirm first.
 */
export function importAll(
  a: StorageAdapter,
  json: string,
): { ok: true } | { ok: false; error: string } {
  const result = validate(json)
  if (!result.ok) return result
  for (const key of a.keys()) {
    if (key.startsWith(KEY_PREFIX)) a.remove(key)
  }
  for (const [k, v] of Object.entries(result.file.data)) a.set(k, v)
  runMigrations(a)
  return { ok: true }
}
