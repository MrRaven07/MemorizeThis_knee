import { describe, expect, it } from 'vitest'
import { getNameSet, nameSets } from './index'
import { ro } from './ro'
import { foldName, NF_LEVELS } from '../logic'

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

  it('no duplicates after accent folding; no first name in both lists', () => {
    for (const list of [ro.female, ro.male, ro.last]) {
      const folded = list.map(foldName)
      expect(new Set(folded).size).toBe(list.length)
    }
    const male = new Set(ro.male.map(foldName))
    expect(ro.female.filter((n) => male.has(foldName(n)))).toEqual([])
  })

  it('enough names for the biggest round, and one spelling per surname', () => {
    const max = Math.max(...NF_LEVELS)
    expect(ro.female.length).toBeGreaterThanOrEqual(max)
    expect(ro.male.length).toBeGreaterThanOrEqual(max)
    expect(ro.last.length).toBeGreaterThanOrEqual(max)
    // î/â spellings of one surname (Sîrbu/Sârbu) would mark a correct answer wrong
    const key = (n: string) => foldName(n).replace(/i/g, 'a')
    const seen = new Map<string, string>()
    const clashes = ro.last.filter((n) => {
      const k = key(n)
      if (seen.has(k) && seen.get(k) !== n) return true
      seen.set(k, n)
      return false
    })
    expect(clashes).toEqual([])
  })
})
