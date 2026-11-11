import type { Clock } from '@/core/timing/countdown'

/** A session ends by itself after this much inactivity. */
export const IDLE_TIMEOUT_MS = 30 * 60_000

export interface SessionRecord {
  id: string
  /** epoch ms */
  startedAt: number
  /** epoch ms, null while the session is open */
  endedAt: number | null
  /** time actually spent playing (game screen visible) */
  activeMs: number
  rounds: number
  /** flashcard answers (schema v2) */
  cards: number
  perGameMs: Record<string, number>
  /** epoch ms of the last start/stop/round — used for the idle timeout */
  lastActivityAt: number
}

export interface Tracker {
  start(gameId: string): void
  stop(): void
  isActive(): boolean
  activeMs(): number
  perGameMs(): Record<string, number>
}

/** Sums start→stop spans (the live span included), per game. */
export function createTracker(
  clock: Clock,
  initial: { activeMs: number; perGameMs: Record<string, number> } = { activeMs: 0, perGameMs: {} },
): Tracker {
  let banked = initial.activeMs
  const perGame: Record<string, number> = { ...initial.perGameMs }
  let live: { gameId: string; since: number } | null = null

  const stop = () => {
    if (!live) return
    const span = clock() - live.since
    banked += span
    perGame[live.gameId] = (perGame[live.gameId] ?? 0) + span
    live = null
  }

  return {
    start(gameId) {
      stop()
      live = { gameId, since: clock() }
    },
    stop,
    isActive: () => live !== null,
    activeMs: () => banked + (live ? clock() - live.since : 0),
    perGameMs: () => {
      const out = { ...perGame }
      if (live) out[live.gameId] = (out[live.gameId] ?? 0) + (clock() - live.since)
      return out
    },
  }
}

export function isExpired(lastActivityAt: number, now: number, idleMs = IDLE_TIMEOUT_MS): boolean {
  return now - lastActivityAt >= idleMs
}
