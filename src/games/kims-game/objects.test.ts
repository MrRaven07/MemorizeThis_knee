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

  it('every emoji is a single picture: no ZWJ sequences, no flags, no skin tones', () => {
    for (const o of KIM_OBJECTS) {
      const cps = Array.from(o.emoji).map((c) => c.codePointAt(0)!)
      expect(cps, o.id).not.toContain(0x200d)
      expect(
        cps.some((c) => c >= 0x1f1e6 && c <= 0x1f1ff),
        o.id,
      ).toBe(false)
      expect(
        cps.some((c) => c >= 0x1f3fb && c <= 0x1f3ff),
        o.id,
      ).toBe(false)
      // one base code point, optionally followed by the emoji presentation selector
      expect(cps.filter((c) => c !== 0xfe0f), o.id).toHaveLength(1)
    }
  })

  it('stays out of the Unicode 14+ emoji blocks (renders on older Android)', () => {
    for (const o of KIM_OBJECTS) {
      const cp = o.emoji.codePointAt(0)!
      // Unicode 14/15 added objects at U+1FA7B–1FA7C, U+1FAA9–1FAAF, U+1FAB7–1FABF,
      // U+1FAC3–1FAC5 and U+1FAD7–1FAFF
      const recent =
        (cp >= 0x1fa7b && cp <= 0x1fa7f) ||
        (cp >= 0x1faa9 && cp <= 0x1faaf) ||
        (cp >= 0x1fab7 && cp <= 0x1fabf) ||
        (cp >= 0x1fac3 && cp <= 0x1facf) ||
        (cp >= 0x1fad7 && cp <= 0x1faff)
      expect(recent, o.id).toBe(false)
    }
  })

  it('ids are kebab-case and names are lower-case words', () => {
    for (const o of KIM_OBJECTS) {
      expect(o.id).toMatch(/^[a-z]+(-[a-z]+)*$/)
      expect(o.name).toMatch(/^[a-z]+( [a-z]+)*$/)
    }
  })

  it('looks objects up by id', () => {
    expect(objectById('key')).toEqual({ id: 'key', emoji: '🔑', name: 'key' })
    expect(objectById('no-such-thing')).toBeUndefined()
  })
})
