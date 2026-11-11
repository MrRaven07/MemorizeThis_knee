import { afterEach, describe, expect, it, vi } from 'vitest'
import { newId } from './id'

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses randomUUID when available', () => {
    expect(newId()).toMatch(V4)
  })

  it('falls back to getRandomValues on old WebViews', () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', {
      getRandomValues: (a: Uint8Array<ArrayBuffer>) => real.getRandomValues(a),
    })
    const ids = new Set(Array.from({ length: 50 }, () => newId()))
    expect(ids.size).toBe(50)
    for (const id of ids) expect(id).toMatch(V4)
  })
})
