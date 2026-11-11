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
    const violations: string[] = []
    const bucharestLengths = new Set<number>()
    for (let i = 0; i < 2000; i++) {
      const p = ro.generate(rng)
      const [county = '', digits = '', letters = ''] = p.segments
      const problems = [
        p.country !== 'ro' && 'country',
        p.text !== p.segments.join(' ') && 'text',
        !RO_COUNTIES.includes(county as (typeof RO_COUNTIES)[number]) && 'county',
        county === 'B' && !/^\d{2,3}$/.test(digits) && 'B digits',
        county === 'B' && digits.length === 3 && Number(digits) < 100 && 'B 3-digit < 100',
        county !== 'B' && !/^\d{2}$/.test(digits) && 'digits',
        digits === '00' && '00',
        !/^[A-PR-Z]{3}$/.test(letters) && 'letters',
        (letters[0] === 'I' || letters[0] === 'O') && 'first letter I/O',
        RO_RESERVED.includes(letters as (typeof RO_RESERVED)[number]) && 'reserved',
        !ro.isValid(p.text) && 'isValid',
      ].filter(Boolean)
      if (problems.length > 0) violations.push(`${p.text}: ${problems.join(', ')}`)
      if (county === 'B') bucharestLengths.add(digits.length)
    }
    expect(violations).toEqual([])
    expect([...bucharestLengths].sort()).toEqual([2, 3])
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

  it('JEG and BOU are never dealt at random but are valid plates', () => {
    const rng = createRng(11)
    const dealt = Array.from({ length: 50_000 }, () => ro.generate(rng).segments[2])
    expect(dealt.filter((l) => l === 'JEG' || l === 'BOU')).toEqual([])
    expect(ro.isValid('B 12 JEG')).toBe(true)
  })
})
