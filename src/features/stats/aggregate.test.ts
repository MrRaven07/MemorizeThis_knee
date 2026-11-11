import { describe, expect, it } from 'vitest'
import type { SessionRecord } from '@/core/session/tracker'
import type { RoundRecord } from '@/games/types'
import { dailyTrend, dayStreak, localDay, sessionSummary, timePerGame, totals } from './aggregate'

const at = (d: number, h = 12, m = 0) => new Date(2026, 10, d, h, m).getTime() // November 2026, local time

function session(id: string, startedAt: number, extra: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id,
    startedAt,
    endedAt: startedAt + 1000,
    activeMs: 60_000,
    rounds: 2,
    cards: 0,
    perGameMs: {},
    lastActivityAt: startedAt,
    ...extra,
  }
}

function round(gameId: string, when: number, extra: Partial<RoundRecord> = {}): RoundRecord {
  return {
    id: `${gameId}${when}`,
    gameId,
    at: when,
    sessionId: null,
    success: true,
    level: null,
    accuracy: 1,
    durationMs: 1,
    metrics: {},
    ...extra,
  }
}

describe('localDay', () => {
  it('splits at local midnight', () => {
    expect(localDay(at(10, 23, 50))).toBe('2026-11-10')
    expect(localDay(at(11, 0, 10))).toBe('2026-11-11')
  })
})

describe('dayStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(dayStreak([at(9), at(10), at(11), at(11, 8)], at(11, 20))).toBe(3)
  })
  it('a day without play yet today still keeps yesterday’s streak', () => {
    expect(dayStreak([at(9), at(10)], at(11, 9))).toBe(2)
  })
  it('a gap breaks it; nothing gives 0', () => {
    expect(dayStreak([at(7), at(10)], at(11))).toBe(1)
    expect(dayStreak([at(5)], at(11))).toBe(0)
    expect(dayStreak([], at(11))).toBe(0)
  })
})

describe('timePerGame and totals', () => {
  it('sums per game and sorts by time', () => {
    const s = [
      session('a', at(1), { perGameMs: { maze: 1000, major: 5000 } }),
      session('b', at(2), { perGameMs: { maze: 7000, plates: 0 } }),
    ]
    expect(timePerGame(s)).toEqual([
      { id: 'maze', ms: 8000 },
      { id: 'major', ms: 5000 },
    ])
  })
  it('totals and empty totals', () => {
    const s = [session('a', at(1), { cards: 3 }), session('b', at(2), { activeMs: 1000 })]
    expect(totals(s, [round('maze', at(1)), round('maze', at(2))])).toEqual({
      activeMs: 61_000,
      sessions: 2,
      rounds: 2,
      cards: 3,
    })
    expect(totals([], [])).toEqual({ activeMs: 0, sessions: 0, rounds: 0, cards: 0 })
  })
})

describe('dailyTrend', () => {
  it('adaptive games: highest level per local day', () => {
    const rounds = [
      round('nf', at(9, 10), { level: 4 }),
      round('nf', at(9, 23, 50), { level: 6 }),
      round('nf', at(10, 0, 10), { level: 5 }),
    ]
    expect(dailyTrend(rounds)).toEqual({
      kind: 'level',
      points: [
        { day: '2026-11-09', value: 6 },
        { day: '2026-11-10', value: 5 },
      ],
    })
  })
  it('other games: average accuracy (%) per day', () => {
    const rounds = [round('ln', at(9), { accuracy: 1 }), round('ln', at(9, 13), { accuracy: 0.5 })]
    expect(dailyTrend(rounds)).toEqual({
      kind: 'accuracy',
      points: [{ day: '2026-11-09', value: 75 }],
    })
  })
  it('keeps the last N days and handles no rounds', () => {
    const rounds = [1, 2, 3, 4].map((d) => round('nf', at(d), { level: d }))
    expect(dailyTrend(rounds, 2).points.map((p) => p.value)).toEqual([3, 4])
    expect(dailyTrend([])).toEqual({ kind: 'accuracy', points: [] })
  })
})

describe('sessionSummary', () => {
  it('rounds of this session, time per game and the comparison', () => {
    const prev = session('p', at(9), { activeMs: 10 * 60_000, rounds: 5 })
    const cur = session('c', at(10), {
      activeMs: 22 * 60_000,
      rounds: 2,
      cards: 4,
      perGameMs: { maze: 60_000, major: 30_000 },
    })
    const rounds = [
      round('maze', at(10), { sessionId: 'c' }),
      round('maze', at(10, 13), { sessionId: 'c' }),
      round('maze', at(9), { sessionId: 'p' }),
    ]
    const s = sessionSummary(cur, rounds, prev)
    expect(s.activeMs).toBe(22 * 60_000)
    expect(s.cards).toBe(4)
    expect(s.perGame.map((g) => [g.id, g.rounds.length, g.ms])).toEqual([
      ['maze', 2, 60_000],
      ['major', 0, 30_000],
    ])
    expect(s.vsPrevious).toEqual({ ms: 12 * 60_000, rounds: -3 })
    expect(sessionSummary(cur, rounds, null).vsPrevious).toBeNull()
  })
})
