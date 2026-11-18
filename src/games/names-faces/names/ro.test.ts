import { describe, expect, it } from 'vitest'
import { getNameSet, nameSets } from './index'
import { ro } from './ro'

describe('Romanian names', () => {
  it('has enough distinct names', () => {
    expect(new Set(ro.female).size).toBe(ro.female.length)
    expect(new Set(ro.male).size).toBe(ro.male.length)
    expect(new Set(ro.last).size).toBe(ro.last.length)
    expect(ro.female.length).toBeGreaterThanOrEqual(100)
    expect(ro.male.length).toBeGreaterThanOrEqual(100)
    expect(ro.last.length).toBeGreaterThanOrEqual(150)
  })

  it('uses comma-below ș/ț and NFC text, no cedilla forms', () => {
    const all = [...ro.female, ...ro.male, ...ro.last]
    expect(all.filter((n) => /[şţŞŢ]/.test(n))).toEqual([])
    expect(all.filter((n) => n !== n.normalize('NFC'))).toEqual([])
    expect(all.filter((n) => n.trim() !== n || n === '')).toEqual([])
  })

  it('is registered and is the fallback', () => {
    expect(nameSets.map((n) => n.id)).toEqual(['ro'])
    expect(getNameSet('zz')).toBe(ro)
  })
})
