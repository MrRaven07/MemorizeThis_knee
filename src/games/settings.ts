import type { GameSettings, SettingField } from './types'

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Turns anything (saved JSON, form input) into valid settings: unknown keys are
 * dropped, missing/invalid values fall back to the default, numbers are clamped
 * to [min, max] and snapped to `step`. A round can never start with NaN.
 */
export function sanitizeSettings<S extends GameSettings>(
  raw: unknown,
  defaults: S,
  fields: SettingField[],
): S {
  const src = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const out: GameSettings = { ...defaults }

  for (const field of fields) {
    const value = src[field.key]
    if (field.type === 'number') {
      const n = toNumber(value)
      if (n === null) continue
      const step = field.step ?? 1
      const snapped = Math.round((n - field.min) / step) * step + field.min
      // round away float noise like 1.5000000000000002
      out[field.key] = Math.min(field.max, Math.max(field.min, Number(snapped.toFixed(6))))
    } else if (field.type === 'boolean') {
      if (typeof value === 'boolean') out[field.key] = value
    } else if (typeof value === 'string' && field.options.some((o) => o.value === value)) {
      out[field.key] = value
    }
  }
  return out as S
}
