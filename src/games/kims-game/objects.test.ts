import { describe, expect, it } from 'vitest'
import { KIM_OBJECTS, objectById } from './objects'

describe("Kim's Game catalogue", () => {
  it('has at least 80 objects with unique ids, emoji and names', () => {
    expect(KIM_OBJECTS.length).toBeGreaterThanOrEqual(80)
    for (const key of ['id', 'emoji', 'name'] as const) {
      const values = KIM_OBJECTS.map((o) => o[key])
      expect(new Set(values).size).toBe(values.length)
    }
  })

  const codePoints = (emoji: string) => Array.from(emoji).map((c) => c.codePointAt(0)!)
  const offenders = (bad: (cps: number[]) => boolean) =>
    KIM_OBJECTS.filter((o) => bad(codePoints(o.emoji))).map((o) => o.id)

  it('every emoji is a single picture: no ZWJ sequences, no flags, no skin tones', () => {
    expect(offenders((cps) => cps.includes(0x200d))).toEqual([])
    expect(offenders((cps) => cps.some((c) => c >= 0x1f1e6 && c <= 0x1f1ff))).toEqual([])
    expect(offenders((cps) => cps.some((c) => c >= 0x1f3fb && c <= 0x1f3ff))).toEqual([])
    // one base code point, optionally followed by the emoji presentation selector
    expect(offenders((cps) => cps.filter((c) => c !== 0xfe0f).length !== 1)).toEqual([])
  })

  it('stays out of the Unicode 14+ emoji blocks (renders on older Android)', () => {
    // Unicode 14/15 added objects at U+1FA7B–1FA7F, U+1FAA9–1FAAF, U+1FAB7–1FABF,
    // U+1FAC3–1FACF and U+1FAD7–1FAFF
    const recent = ([cp]: number[]) =>
      (cp! >= 0x1fa7b && cp! <= 0x1fa7f) ||
      (cp! >= 0x1faa9 && cp! <= 0x1faaf) ||
      (cp! >= 0x1fab7 && cp! <= 0x1fabf) ||
      (cp! >= 0x1fac3 && cp! <= 0x1facf) ||
      (cp! >= 0x1fad7 && cp! <= 0x1faff)
    expect(offenders(recent)).toEqual([])
  })

  it('ids are kebab-case and names are lower-case words', () => {
    expect(KIM_OBJECTS.filter((o) => !/^[a-z]+(-[a-z]+)*$/.test(o.id))).toEqual([])
    expect(KIM_OBJECTS.filter((o) => !/^[a-z]+( [a-z]+)*$/.test(o.name))).toEqual([])
  })

  it('looks objects up by id', () => {
    expect(objectById('key')).toEqual({ id: 'key', emoji: '🔑', name: 'key' })
    expect(objectById('no-such-thing')).toBeUndefined()
  })
})
