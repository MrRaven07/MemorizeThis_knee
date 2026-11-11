import type { Rng } from '@/core/random/rng'

/**
 * Smart study order (question 010). No calendar due dates — a session "tick"
 * counts cards shown. Each box has an interval; the card most overdue relative
 * to its interval comes next, so weak cards come up often and known cards
 * still return (less often). A missed card is forced back after exactly 3
 * other cards.
 */
export const INTERVALS = [1, 3, 9, 27, 81] as const

export interface SmartSession {
  /** cards shown so far this session */
  tick: number
  /** tick at which each card was last shown */
  lastSeen: Record<string, number>
  /** missed cards waiting to come back */
  forced: { id: string; dueTick: number }[]
  /** the most recently shown cards, newest last (kept out of the next draws) */
  recent: string[]
  /** how many of the latest cards were forced returns in a row */
  forcedStreak: number
}

/** After this many forced returns in a row, one score-based card comes next (question 013). */
const MAX_FORCED_IN_A_ROW = 3
/** A card never reappears within the last K draws, K = min(RECENT_GAP, cards − 1) (question 013). */
const RECENT_GAP = 3

const intervalOf = (box: number) => INTERVALS[Math.min(5, Math.max(1, box)) - 1]!

export function createSmartSession(): SmartSession {
  return { tick: 0, lastSeen: {}, forced: [], recent: [], forcedStreak: 0 }
}

export function nextBox(box: number, knew: boolean): number {
  return knew ? Math.min(5, box + 1) : 1
}

export function nextSmart(
  session: SmartSession,
  ids: string[],
  boxOf: (id: string) => number,
): string {
  if (ids.length === 0) throw new Error('No cards to study')
  const inDeck = new Set(ids)
  const live = session.forced.filter((f) => inDeck.has(f.id))

  const k = Math.min(RECENT_GAP, ids.length - 1)
  const blocked = new Set(k > 0 ? session.recent.slice(-k) : [])

  const due = live
    .filter((f) => f.dueTick <= session.tick && !blocked.has(f.id))
    .sort((a, b) => a.dueTick - b.dueTick)
  if (due.length > 0 && session.forcedStreak < MAX_FORCED_IN_A_ROW) return due[0]!.id

  // Cards waiting for their forced return are held back until then, and the
  // last K cards shown never come straight back.
  const waiting = new Set(live.map((f) => f.id))
  const allowed = ids.filter((id) => !blocked.has(id))
  const candidates = allowed.filter((id) => !waiting.has(id))
  const pool = candidates.length > 0 ? candidates : allowed.length > 0 ? allowed : ids

  let best = pool[0]!
  let bestScore = -Infinity
  let bestBox = Infinity
  for (const id of pool) {
    const box = boxOf(id)
    const interval = intervalOf(box)
    const last = session.lastSeen[id] ?? -interval
    const score = (session.tick - last + 1) / interval
    if (score > bestScore || (score === bestScore && box < bestBox)) {
      best = id
      bestScore = score
      bestBox = box
    }
  }
  return best
}

/** Records an answer to the card just shown and advances the session. */
export function recordSmart(
  session: SmartSession,
  id: string,
  knew: boolean,
  cardCount: number,
): SmartSession {
  const shownAt = session.tick
  const wasForced = session.forced.some((f) => f.id === id && f.dueTick <= shownAt)
  const forced = session.forced.filter((f) => f.id !== id)
  if (!knew) {
    const others = Math.min(3, Math.max(0, cardCount - 1))
    forced.push({ id, dueTick: shownAt + 1 + others })
  }
  return {
    tick: shownAt + 1,
    lastSeen: { ...session.lastSeen, [id]: shownAt },
    forced,
    recent: [...session.recent, id].slice(-RECENT_GAP),
    forcedStreak: wasForced ? session.forcedStreak + 1 : 0,
  }
}

export function shuffleOrder(rng: Rng, ids: string[]): string[] {
  return rng.shuffle(ids)
}
