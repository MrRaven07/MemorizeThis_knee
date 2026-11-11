import type { SessionRecord } from '@/core/session/tracker'
import type { RoundRecord } from '@/games/types'

/** Pure aggregation for the Stats page and session summary (question 011). */

const DAY_MS = 86_400_000

/** `YYYY-MM-DD` in the player's local time. */
export function localDay(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Consecutive local days with a session, ending today (or yesterday if today has none yet). */
export function dayStreak(sessionStarts: number[], now: number): number {
  const days = new Set(sessionStarts.map(localDay))
  let cursor = new Date(now)
  cursor.setHours(12, 0, 0, 0) // noon avoids DST edge cases when stepping days
  if (!days.has(localDay(cursor.getTime()))) cursor = new Date(cursor.getTime() - DAY_MS)
  let streak = 0
  while (days.has(localDay(cursor.getTime()))) {
    streak++
    cursor = new Date(cursor.getTime() - DAY_MS)
  }
  return streak
}

export function timePerGame(sessions: SessionRecord[]): { id: string; ms: number }[] {
  const sum = new Map<string, number>()
  for (const s of sessions) {
    for (const [id, ms] of Object.entries(s.perGameMs ?? {})) sum.set(id, (sum.get(id) ?? 0) + ms)
  }
  return [...sum.entries()]
    .filter(([, ms]) => ms > 0)
    .map(([id, ms]) => ({ id, ms }))
    .sort((a, b) => b.ms - a.ms)
}

export function totals(sessions: SessionRecord[], rounds: RoundRecord[]) {
  return {
    activeMs: sessions.reduce((a, s) => a + (s.activeMs ?? 0), 0),
    sessions: sessions.length,
    rounds: rounds.length,
    cards: sessions.reduce((a, s) => a + (s.cards ?? 0), 0),
  }
}

export interface Trend {
  /** adaptive games plot the day's highest level; others the day's average accuracy (%) */
  kind: 'level' | 'accuracy'
  points: { day: string; value: number }[]
}

/** One point per local day (the last `days` days that have data). */
export function dailyTrend(rounds: RoundRecord[], days = 30): Trend {
  const kind: Trend['kind'] = rounds.some((r) => typeof r.level === 'number') ? 'level' : 'accuracy'
  const byDay = new Map<string, number[]>()
  for (const r of rounds) {
    const v = kind === 'level' ? r.level : r.accuracy
    if (typeof v !== 'number' || !Number.isFinite(v)) continue
    const day = localDay(r.at)
    byDay.set(day, [...(byDay.get(day) ?? []), v])
  }
  const points = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, values]) => ({
      day,
      value:
        kind === 'level'
          ? Math.max(...values)
          : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100),
    }))
  return { kind, points: points.slice(-days) }
}

export function sessionSummary(
  session: SessionRecord,
  allRounds: RoundRecord[],
  previous: SessionRecord | null,
) {
  const mine = allRounds.filter((r) => r.sessionId === session.id)
  const ids = new Set<string>([
    ...Object.keys(session.perGameMs ?? {}),
    ...mine.map((r) => r.gameId),
  ])
  const perGame = [...ids]
    .map((id) => ({
      id,
      rounds: mine.filter((r) => r.gameId === id),
      ms: session.perGameMs?.[id] ?? 0,
    }))
    .filter((g) => g.rounds.length > 0 || g.ms > 0)
    .sort((a, b) => b.ms - a.ms || b.rounds.length - a.rounds.length)
  return {
    activeMs: session.activeMs,
    rounds: session.rounds,
    cards: session.cards ?? 0,
    perGame,
    vsPrevious: previous
      ? { ms: session.activeMs - previous.activeMs, rounds: session.rounds - previous.rounds }
      : null,
  }
}
