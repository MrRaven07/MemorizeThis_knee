import { describe, expect, it, vi } from 'vitest'
import { BUZZ_HZ, PAD_FREQUENCIES, RAMP_S, createTonePlayer, type AudioContextLike } from './tones'

/** A tiny fake of the parts of the Web Audio API the player uses. */
function fakeContext(state: 'running' | 'suspended' = 'running') {
  const oscillators: {
    type: string
    frequency: number
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
  }[] = []
  const gains: { calls: [string, number, number][] }[] = []
  const ctx = {
    currentTime: 10,
    state,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
    createOscillator() {
      const o = {
        type: 'sine',
        frequency: {
          setValueAtTime: (v: number) => {
            rec.frequency = v
          },
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }
      const rec = { type: '', frequency: 0, start: o.start, stop: o.stop }
      Object.defineProperty(rec, 'type', { get: () => o.type })
      oscillators.push(rec)
      return o
    },
    createGain() {
      const rec = { calls: [] as [string, number, number][] }
      gains.push(rec)
      return {
        gain: {
          setValueAtTime: (v: number, t: number) => rec.calls.push(['set', v, t]),
          linearRampToValueAtTime: (v: number, t: number) => rec.calls.push(['ramp', v, t]),
        },
        connect: vi.fn(),
      }
    },
  }
  return { ctx: ctx as unknown as AudioContextLike, raw: ctx, oscillators, gains }
}

describe('tones', () => {
  it('nine pentatonic pad frequencies, rising, and a low buzz', () => {
    expect(PAD_FREQUENCIES).toHaveLength(9)
    for (let i = 1; i < 9; i++) expect(PAD_FREQUENCIES[i]!).toBeGreaterThan(PAD_FREQUENCIES[i - 1]!)
    expect(BUZZ_HZ).toBeLessThan(PAD_FREQUENCIES[0]!)
  })

  it('creates no AudioContext before unlock (first user gesture)', () => {
    const factory = vi.fn(() => fakeContext().ctx)
    const p = createTonePlayer({ createContext: factory })
    p.play(0, 500, 60)
    expect(factory).not.toHaveBeenCalled()
    p.unlock()
    p.unlock()
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('plays a pad tone with 10 ms fade in and out', () => {
    const f = fakeContext()
    const p = createTonePlayer({ createContext: () => f.ctx })
    p.unlock()
    p.play(2, 500, 50)
    expect(f.oscillators).toHaveLength(1)
    expect(f.oscillators[0]!.frequency).toBe(PAD_FREQUENCIES[2])
    expect(f.oscillators[0]!.start).toHaveBeenCalledWith(10)
    expect(f.oscillators[0]!.stop).toHaveBeenCalled()
    const calls = f.gains[0]!.calls
    expect(calls[0]).toEqual(['set', 0, 10])
    expect(calls[1]![0]).toBe('ramp')
    expect(calls[1]![2]).toBeCloseTo(10 + RAMP_S)
    expect(calls.at(-1)![1]).toBe(0)
    expect(calls.at(-1)![2]).toBeCloseTo(10.5)
    // peak scales with volume, never above 1
    expect(calls[1]![1]).toBeGreaterThan(0)
    expect(calls[1]![1]).toBeLessThanOrEqual(1)
  })

  it('volume 0 plays nothing; buzz uses the low frequency', () => {
    const f = fakeContext()
    const p = createTonePlayer({ createContext: () => f.ctx })
    p.unlock()
    p.play(0, 300, 0)
    expect(f.oscillators).toHaveLength(0)
    p.buzz(400, 60)
    expect(f.oscillators[0]!.frequency).toBe(BUZZ_HZ)
  })

  it('resumes a suspended context on unlock', () => {
    const f = fakeContext('suspended')
    const p = createTonePlayer({ createContext: () => f.ctx })
    p.unlock()
    expect(f.raw.resume).toHaveBeenCalled()
  })

  it('stays silent when audio is unavailable or throws', () => {
    const none = createTonePlayer({ createContext: () => null })
    none.unlock()
    expect(() => none.play(0, 300, 60)).not.toThrow()
    const broken = createTonePlayer({
      createContext: () => {
        throw new Error('no audio')
      },
    })
    expect(() => broken.unlock()).not.toThrow()
    expect(() => broken.buzz(300, 60)).not.toThrow()
  })

  it('the default factory is silent where there is no Web Audio (jsdom)', () => {
    const p = createTonePlayer()
    expect(() => {
      p.unlock()
      p.play(1, 300, 60)
      p.dispose()
    }).not.toThrow()
  })

  it('dispose closes the context', () => {
    const f = fakeContext()
    const p = createTonePlayer({ createContext: () => f.ctx })
    p.unlock()
    p.dispose()
    expect(f.raw.close).toHaveBeenCalled()
  })
})
