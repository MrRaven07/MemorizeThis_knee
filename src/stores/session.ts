import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { createTracker, isExpired, type SessionRecord, type Tracker } from '@/core/session/tracker'
import { appStorage, isPlainObject, loadJson, saveJson } from '@/core/storage/persist'

export const SESSION_CURRENT_KEY = 'mt:session-current'
export const SESSIONS_KEY = 'mt:sessions'

/** Session time uses wall-clock ms so it survives reloads (docs/agents/questions/002). */
const clock = () => Date.now()

function isSessionRecord(v: unknown): v is SessionRecord {
  if (!isPlainObject(v)) return false
  const num = (k: string) => typeof v[k] === 'number' && Number.isFinite(v[k])
  return (
    typeof v.id === 'string' &&
    num('startedAt') &&
    num('activeMs') &&
    num('rounds') &&
    num('lastActivityAt') &&
    isPlainObject(v.perGameMs)
  )
}

/**
 * Tracks play time. A session counts UP with no limit; only time on a game
 * screen with the tab visible counts. The open session is saved continuously,
 * so closing the tab loses nothing.
 */
export const useSessionStore = defineStore('session', () => {
  const sessions = ref<SessionRecord[]>(
    loadJson<SessionRecord[]>(appStorage, SESSIONS_KEY, [], Array.isArray),
  )
  const current = ref<SessionRecord | null>(null)
  const active = ref(false)
  const tick = ref(0)

  let tracker: Tracker = createTracker(clock)
  let activeGame: string | null = null
  let resumeAfterHidden: string | null = null
  let ticker: ReturnType<typeof setInterval> | null = null

  function persistCurrent() {
    if (current.value) saveJson(appStorage, SESSION_CURRENT_KEY, current.value)
    else appStorage.remove(SESSION_CURRENT_KEY)
  }

  function snapshot() {
    if (!current.value) return
    current.value.activeMs = tracker.activeMs()
    current.value.perGameMs = tracker.perGameMs()
    current.value.lastActivityAt = Date.now()
  }

  function finalize(rec: SessionRecord, endedAt: number) {
    sessions.value.push({ ...rec, endedAt })
    saveJson(appStorage, SESSIONS_KEY, sessions.value)
  }

  function openSession(rec: SessionRecord) {
    current.value = { ...rec, cards: typeof rec.cards === 'number' ? rec.cards : 0 }
    tracker = createTracker(clock, { activeMs: rec.activeMs, perGameMs: rec.perGameMs })
  }

  function ensureSession() {
    if (current.value && isExpired(current.value.lastActivityAt, Date.now())) {
      finalize(current.value, current.value.lastActivityAt)
      current.value = null
    }
    if (!current.value) {
      const now = Date.now()
      openSession({
        id: globalThis.crypto.randomUUID(),
        startedAt: now,
        endedAt: null,
        activeMs: 0,
        rounds: 0,
        cards: 0,
        perGameMs: {},
        lastActivityAt: now,
      })
    }
  }

  function startTicker() {
    if (ticker === null) ticker = setInterval(() => tick.value++, 1000)
  }
  function stopTicker() {
    if (ticker !== null) clearInterval(ticker)
    ticker = null
  }

  function beginActivity(gameId: string) {
    ensureSession()
    tracker.start(gameId)
    activeGame = gameId
    active.value = true
    startTicker()
    snapshot()
    persistCurrent()
  }

  /** Called when the game screen goes away. */
  function endActivity() {
    resumeAfterHidden = null
    pauseActivity()
  }

  function pauseActivity() {
    if (!active.value) return
    tracker.stop()
    active.value = false
    activeGame = null
    stopTicker()
    snapshot()
    persistCurrent()
  }

  function noteCard() {
    if (!current.value) ensureSession()
    current.value!.cards = (current.value!.cards ?? 0) + 1
    snapshot()
    persistCurrent()
  }

  function noteRound() {
    if (!current.value) ensureSession()
    current.value!.rounds++
    snapshot()
    persistCurrent()
  }

  function endSession(): SessionRecord | null {
    endActivity()
    if (!current.value) return null
    const rec: SessionRecord = { ...current.value, endedAt: Date.now() }
    finalize(current.value, rec.endedAt!)
    current.value = null
    persistCurrent()
    return rec
  }

  const liveActiveMs = computed(() => {
    void tick.value // re-evaluate every second while active
    return current.value ? tracker.activeMs() : 0
  })
  const isActive = computed(() => active.value)

  // Restore the open session saved before a reload.
  const saved = loadJson<SessionRecord | null>(
    appStorage,
    SESSION_CURRENT_KEY,
    null,
    isSessionRecord,
  )
  if (saved) {
    if (isExpired(saved.lastActivityAt, Date.now())) {
      finalize(saved, saved.lastActivityAt)
      appStorage.remove(SESSION_CURRENT_KEY)
    } else {
      openSession(saved)
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (active.value) {
          const game = activeGame
          pauseActivity()
          resumeAfterHidden = game
        }
      } else if (resumeAfterHidden) {
        const game = resumeAfterHidden
        resumeAfterHidden = null
        beginActivity(game)
      }
    })
    globalThis.addEventListener?.('pagehide', () => endActivity())
  }

  return {
    sessions,
    current,
    liveActiveMs,
    isActive,
    beginActivity,
    endActivity,
    noteRound,
    noteCard,
    endSession,
  }
})
