/**
 * Short pad tones through the Web Audio API (Sequence game, questions/018).
 *
 * - The AudioContext is created lazily in `unlock()`, which the game calls from
 *   a user gesture (browsers and Android WebViews block audio before one).
 * - Pentatonic frequencies, so any order of pads sounds pleasant.
 * - 10 ms fade in/out on every tone to avoid clicks.
 * - If Web Audio is missing or fails, every call is a silent no-op.
 */

/** C major pentatonic, C4 up to G5 — one per pad. */
export const PAD_FREQUENCIES: readonly number[] = [
  261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99,
]
/** The low "wrong pad" buzz. */
export const BUZZ_HZ = 110
/** Fade in/out time, seconds. */
export const RAMP_S = 0.01
/** Gain at volume 100 (pure tones at full gain are harsh). */
const MAX_GAIN = 0.4

/** The small part of AudioContext the player uses (so tests can fake it). */
export interface AudioContextLike {
  readonly currentTime: number
  readonly state: string
  readonly destination: unknown
  resume(): Promise<void>
  close(): Promise<void>
  createOscillator(): {
    type: string
    frequency: { setValueAtTime(v: number, t: number): unknown }
    connect(node: unknown): unknown
    start(t: number): void
    stop(t: number): void
  }
  createGain(): {
    gain: {
      setValueAtTime(v: number, t: number): unknown
      linearRampToValueAtTime(v: number, t: number): unknown
    }
    connect(node: unknown): unknown
  }
}

export interface TonePlayer {
  /** Call from a user gesture: creates (or resumes) the AudioContext. */
  unlock(): void
  /** Plays pad `pad` (0-based) for `ms` at `volume` 0..100. */
  play(pad: number, ms: number, volume: number): void
  /** The low buzz for a wrong pad. */
  buzz(ms: number, volume: number): void
  dispose(): void
}

function defaultContext(): AudioContextLike | null {
  const g = globalThis as unknown as {
    AudioContext?: new () => AudioContextLike
    webkitAudioContext?: new () => AudioContextLike
  }
  const Ctor = g.AudioContext ?? g.webkitAudioContext
  return Ctor ? new Ctor() : null
}

export function createTonePlayer(
  opts: { createContext?: () => AudioContextLike | null } = {},
): TonePlayer {
  const createContext = opts.createContext ?? defaultContext
  let ctx: AudioContextLike | null = null
  let tried = false

  function tone(hz: number, ms: number, volume: number, type: string) {
    if (!ctx || volume <= 0 || ms <= 0) return
    try {
      const peak = (Math.min(100, volume) / 100) * MAX_GAIN
      const t0 = ctx.currentTime
      const dur = Math.max(2 * RAMP_S, ms / 1000)
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(hz, t0)
      gain.gain.setValueAtTime(0, t0)
      gain.gain.linearRampToValueAtTime(peak, t0 + RAMP_S)
      gain.gain.setValueAtTime(peak, t0 + dur - RAMP_S)
      gain.gain.linearRampToValueAtTime(0, t0 + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + dur + RAMP_S)
    } catch {
      // audio is a nice-to-have: never break the game
    }
  }

  return {
    unlock() {
      try {
        if (!tried) {
          tried = true
          ctx = createContext()
        }
        if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => {})
      } catch {
        ctx = null
      }
    },
    play(pad, ms, volume) {
      const hz = PAD_FREQUENCIES[pad]
      if (hz !== undefined) tone(hz, ms, volume, 'sine')
    },
    buzz(ms, volume) {
      tone(BUZZ_HZ, ms, volume, 'square')
    },
    dispose() {
      if (ctx) void ctx.close().catch(() => {})
      ctx = null
    },
  }
}
