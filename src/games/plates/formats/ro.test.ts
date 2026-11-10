import { describe, expect, it } from 'vitest'
import { createRng } from '@/core/random/rng'
import { getPlateFormat, plateFormats } from './index'
import { ro, RO_COUNTIES, RO_RESERVED } from './ro'

describe('Romanian plates', () => {
  it('has the 42 counties', () => {
    expect(RO_COUNTIES).toHaveLength(42)
    expect(RO_COUNTIES).toEqual(expect.arrayContaining(['B', 'MM', 'CJ']))
    expect(new Set(RO_COUNTIES).size).toBe(42)
  })

  it('2000 seeded plates obey every rule', () => {
    const rng = createRng(7)
    let b2 = 0
    let b3 = 0
    for (let i = 0; i < 2000; i++) {
      const p = ro.generate(rng)
      expect(p.country).toBe('ro')
      expect(p.text).toBe(p.segments.join(' '))
      const [county, digits, letters] = p.segments as [string, string, string]
      expect(RO_COUNTIES).toContain(county)
      if (county === 'B') {
        expect(digits).toMatch(/^\d{2,3}$/)
        if (digits.length === 3) {
          expect(Number(digits)).toBeGreaterThanOrEqual(100)
          b3++
        } else b2++
      } else {
        expect(digits).toMatch(/^\d{2}$/)
      }
      expect(digits).not.toBe('00')
      expect(letters).toMatch(/^[A-PR-Z]{3}$/)
      expect(letters[0]).not.toBe('I')
      expect(letters[0]).not.toBe('O')
      expect(RO_RESERVED).not.toContain(letters)
      expect(ro.isValid(p.text)).toBe(true)
    }
    expect(b2).toBeGreaterThan(0)
    expect(b3).toBeGreaterThan(0)
  })

  it.each([
    'B 00 ABC',
    'CJ 123 ABC',
    'CJ 12 QAB',
    'CJ 12 IAB',
    'CJ 12 OAB',
    'CJ 12 POL',
    'XX 12 ABC',
    'MM 123 ABC',
    'B 099 ABC',
    'CJ 12 AB',
  ])('isValid rejects %s', (text) => {
    expect(ro.isValid(text)).toBe(false)
  })

  it.each(['B 505 LSK', 'B 12 ABC', 'MM 12 ABC', 'CJ 07 XYZ'])('isValid accepts %s', (text) => {
    expect(ro.isValid(text)).toBe(true)
  })

  it('is registered and is the fallback format', () => {
    expect(plateFormats.map((f) => f.id)).toEqual(['ro'])
    expect(getPlateFormat('ro')).toBe(ro)
    expect(getPlateFormat('zz')).toBe(ro)
  })
})
