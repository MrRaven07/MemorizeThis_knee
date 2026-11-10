/**
 * A countdown measured against a clock (not by counting ticks), so it never
 * drifts. Pure logic — the Vue composable `useCountdown` drives it per frame.
 */
export type Clock = () => number

export const defaultClock: Clock = () => performance.now()

export interface Countdown {
  remaining(): number
  elapsed(): number
  /** 0..1 of the duration that has elapsed. */
  progress(): number
  isDone(): boolean
  pause(): void
  resume(): void
  isPaused(): boolean
}

/** Starts running immediately. */
export function createCountdown(durationMs: number, clock: Clock = defaultClock): Countdown {
  let startedAt = clock()
  let pausedAt: number | null = null

  const elapsed = () => Math.min(durationMs, (pausedAt ?? clock()) - startedAt)

  return {
    elapsed,
    remaining: () => Math.max(0, durationMs - elapsed()),
    progress: () => (durationMs <= 0 ? 1 : elapsed() / durationMs),
    isDone: () => elapsed() >= durationMs,
    pause: () => {
      if (pausedAt === null) pausedAt = clock()
    },
    resume: () => {
      if (pausedAt === null) return
      startedAt += clock() - pausedAt
      pausedAt = null
    },
    isPaused: () => pausedAt !== null,
  }
}
